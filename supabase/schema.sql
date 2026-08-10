-- 기업닥터 AI MVP — Supabase 스키마 (베타 안정화 버전)
-- Supabase SQL Editor에서 한 번 실행하세요. (기존 테이블이 있다면 하단 마이그레이션 섹션도 함께 실행)

create extension if not exists "uuid-ossp";

-- 신청 접수 (STEP1~2)
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),

  -- Google Form 원본 입력
  company_name text not null,
  ceo_name text not null,
  biz_reg_no text,                      -- STEP2에서 검색/보정된 사업자번호

  -- 파이프라인 상태 (STEP12 관리자 페이지 표시용)
  -- ai_analysis: STEP4(AI 재무분석)~STEP5(맞춤 컨설팅 생성)를 함께 커버하는 상태
  status text not null default 'received'
    check (status in ('received','analyzing','awaiting_cretop','ai_analysis','completed','deep_requested','deep_completed','error')),
  error_message text,
  retry_count int not null default 0,   -- STEP11 에러 복구: 자동/수동 재시도 횟수 추적

  -- 원본 응답 메타
  source text default 'google_form',
  raw_form_response jsonb,
  form_response_id text unique,         -- Idempotency: Google Apps Script가 동일 응답을 중복 전송해도 한 번만 처리

  -- 크레탑 세션 자동화(worker)가 조회 결과를 임시로 적재하는 칸.
  -- worker가 이 값을 채우고 /api/agent/continue 를 호출하면 이후 STEP5~8이 이어서 실행된다.
  cretop_cache jsonb,

  -- Worker Lock: cretop-worker.ts가 동일 신청 건을 여러 워커 인스턴스가 동시에
  -- 처리하지 않도록 클레임(선점)하는 용도. 락이 오래(5분+) 유지되면 죽은 워커로 간주하고 회수한다.
  processing_lock_at timestamptz,
  processing_lock_by text
);

-- 1차 건강검진 결과 (STEP4~8)
create table if not exists health_reports (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- STEP4 크레탑 데이터
  cretop_raw jsonb,
  cretop_pdf_url text,

  -- STEP5 공개자료 요약
  public_data_summary jsonb,

  -- STEP6 AI 분석 (14개 항목 — types/index.ts DeepAnalysisResult 참고)
  analysis jsonb,

  -- STEP7 건강점수 — 재무비율 기반 결정론적 산식 (lib/health-score.ts computeHealthScore)
  health_score int check (health_score between 0 and 100),
  score_breakdown jsonb,  -- 성장률/영업이익률/부채비율/유동비율/ROE/ROA/현금흐름 산출 근거
  risk_grade text check (risk_grade in ('A','B','C','D','E')),
  star_ratings jsonb,     -- { finance:5, growth:4, stability:3, tax:5, gov_support:4, patent:2, labor:4 }

  -- STEP8 웹 노출용 요약 (문제 발견 리스트 등)
  findings jsonb,

  -- 하나의 application에 대해 health_report는 하나만 존재해야 함
  -- (재실행 시 upsert로 덮어쓰기 위한 unique 제약 — Idempotency)
  unique (application_id)
);

-- 심층 건강검진 (STEP9~10)
create table if not exists deep_reports (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  created_at timestamptz not null default now(),

  phone_number text,
  phone_verified boolean default false,
  biz_verified boolean default false,

  deep_analysis jsonb,   -- 재무/정부지원/절세/특허/노무/보험 심층 분석 + 종합의견 + 우선순위 + 실행전략
  pdf_url text,          -- Google Drive 저장 링크

  status text not null default 'pending'
    check (status in ('pending','verifying','generating','completed','error')),
  error_message text,

  unique (application_id)
);

-- STEP10: 로그 시스템 — 모든 파이프라인 단계의 실행 이력
create table if not exists logs (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  created_at timestamptz not null default now(),

  step text not null,               -- 'biz_lookup' | 'cretop' | 'public_data' | 'ai_analysis' | 'report' | 'deep_analysis' 등
  status text not null check (status in ('started','success','error','retry','cache_hit','cache_miss')),
  message text,
  token_usage int,                  -- GPT 호출 시 사용된 토큰 수
  duration_ms int,                  -- 실행 시간(ms)
  cost_usd numeric(10,5),           -- GPT 호출 추정 비용(USD) — lib/openai-cost.ts 참고
  retry_count int                   -- 최종 실패 시 몇 회 재시도 후 포기했는지 (retryWithBackoff attempts)
);

-- STEP9: OpenAI 응답 캐시 — 동일 기업+동일 재무데이터는 30일 이내 재호출하지 않음
create table if not exists gpt_cache (
  cache_key text primary key,       -- sha256(회사명 + 재무데이터 fingerprint)
  company_name text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_applications_lock on applications(processing_lock_at);
create index if not exists idx_health_reports_application on health_reports(application_id);
create index if not exists idx_deep_reports_application on deep_reports(application_id);
create index if not exists idx_logs_application on logs(application_id);
create index if not exists idx_logs_step on logs(step);
create index if not exists idx_logs_created_at on logs(created_at desc);
create index if not exists idx_gpt_cache_created_at on gpt_cache(created_at);

-- =========================================================
-- DB Transaction: applications 상태 갱신 + health_reports 저장 + logs 기록을
-- 하나의 트랜잭션으로 묶는 함수. Postgres 함수는 기본적으로 트랜잭션 안에서 실행되므로
-- 중간에 예외가 나면 전체가 롤백된다 (health_reports만 저장되고 status는 안 바뀌는 등의
-- 불일치 상태를 방지).
-- =========================================================
create or replace function fn_save_health_report(
  p_application_id uuid,
  p_cretop_raw jsonb,
  p_public_data_summary jsonb,
  p_analysis jsonb,
  p_health_score int,
  p_score_breakdown jsonb,
  p_risk_grade text,
  p_star_ratings jsonb,
  p_findings jsonb
) returns void as $$
begin
  insert into health_reports (
    application_id, cretop_raw, public_data_summary, analysis,
    health_score, score_breakdown, risk_grade, star_ratings, findings
  ) values (
    p_application_id, p_cretop_raw, p_public_data_summary, p_analysis,
    p_health_score, p_score_breakdown, p_risk_grade, p_star_ratings, p_findings
  )
  on conflict (application_id) do update set
    cretop_raw = excluded.cretop_raw,
    public_data_summary = excluded.public_data_summary,
    analysis = excluded.analysis,
    health_score = excluded.health_score,
    score_breakdown = excluded.score_breakdown,
    risk_grade = excluded.risk_grade,
    star_ratings = excluded.star_ratings,
    findings = excluded.findings;

  update applications
    set status = 'completed', cretop_cache = null, processing_lock_at = null, processing_lock_by = null
    where id = p_application_id;

  insert into logs (application_id, step, status, message)
    values (p_application_id, 'report', 'success', 'health_reports 저장 및 상태 완료 처리 (트랜잭션)');
end;
$$ language plpgsql;

-- =========================================================
-- 마이그레이션: 이전 버전 스키마가 이미 배포되어 있는 경우 아래를 실행
-- (신규 설치라면 위 create table if not exists 만으로 충분하므로 생략 가능)
-- =========================================================
-- alter table applications add column if not exists form_response_id text unique;
-- alter table applications add column if not exists processing_lock_at timestamptz;
-- alter table applications add column if not exists processing_lock_by text;
-- alter table health_reports add constraint health_reports_application_id_key unique (application_id);
-- alter table deep_reports add column if not exists error_message text;
-- alter table deep_reports add constraint deep_reports_application_id_key unique (application_id);
-- alter table logs drop constraint if exists logs_status_check;
-- alter table logs add constraint logs_status_check
--   check (status in ('started','success','error','retry','cache_hit','cache_miss'));
-- alter table logs add column if not exists cost_usd numeric(10,5);
-- alter table logs add column if not exists retry_count int;

-- =========================================================
-- 노무법인 2차 정밀진단 (v11)
-- "company_id"에 해당하는 별도 companies 테이블이 없으므로, 기존 applications를 그대로
-- 회사 식별자로 재사용한다 (1차 건강검진 = 회사 레코드).
-- =========================================================

-- 노무법인 담당자 전용 코드 (관리자가 발급, 회원가입 없음)
create table if not exists labor_partner_users (
  id uuid primary key default uuid_generate_v4(),
  partner_id text not null,           -- 내부 식별자 (화면에 노출하지 않음)
  partner_name text,                  -- 내부 라벨 (관리자 화면에서만 사용, 일반 사용자에게 노출 금지)
  access_code text not null unique,   -- 예: LABOR-XXXX
  is_active boolean not null default true,
  expires_at timestamptz,             -- null이면 만료 없음
  created_at timestamptz not null default now()
);

-- 노무 정밀진단 신청 (6개 기본 질문)
create table if not exists labor_diagnosis (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  partner_id text,                    -- MVP: 비워두면 활성 노무법인 담당자 전원이 조회 가능 (배정 로직은 다음 버전)
  employee_count int,
  insurance_status text check (insurance_status in ('all','partial','none','unknown')),
  hiring_last_year boolean,
  leaving_last_year boolean,
  subsidy_status text check (subsidy_status in ('current','past','none','unknown')),
  main_question text,
  status text not null default 'submitted'
    check (status in ('submitted','in_review','contacted','closed')),
  created_at timestamptz not null default now(),

  unique (application_id) -- 회사당 노무 정밀진단은 1건 (재신청 시 upsert)
);

-- 업로드 서류 메타데이터 (실제 파일은 private Storage 버킷에 저장, 여기엔 경로만)
create table if not exists labor_documents (
  id uuid primary key default uuid_generate_v4(),
  diagnosis_id uuid not null references labor_diagnosis(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  file_name text not null,
  storage_path text not null,         -- labor-documents 버킷 내부 경로
  file_type text,
  file_size int,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_labor_diagnosis_application on labor_diagnosis(application_id);
create index if not exists idx_labor_documents_diagnosis on labor_documents(diagnosis_id);

-- Private Storage 버킷 — public=false, 반드시 서명된 URL 또는 서버 경유로만 접근
insert into storage.buckets (id, name, public)
  values ('labor-documents', 'labor-documents', false)
  on conflict (id) do nothing;

-- 이 프로젝트는 클라이언트가 Supabase에 직접 접근하지 않고 항상 서버(service role)를 거치는
-- 구조이므로(README 참고), storage에 대한 RLS 정책도 "service role만 허용"이 기본이라 별도
-- 정책을 추가하지 않아도 안전하다. 혹시 이 버킷에 대해 별도로 RLS를 켰다면 아래처럼
-- anon/authenticated 접근을 명시적으로 차단해둘 것:
-- create policy "no public access" on storage.objects for select
--   using (bucket_id = 'labor-documents' and false);
