import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 클라이언트 (service role — RLS 우회).
 * 절대 클라이언트(브라우저) 코드에서 import하지 말 것 — service role key가 번들에 노출된다.
 *
 * 보안 원칙: 이 프로젝트는 클라이언트가 Supabase에 직접 접근하지 않고 항상 Next.js API
 * 라우트를 경유하도록 통일했다 (RLS 정책을 개별 테이블마다 관리하는 대신, 인증/검증 로직을
 * 서버 한 곳에 모으기 위함). 브라우저에서 Supabase에 직접 쿼리해야 하는 새 기능을 추가할
 * 때는 anon key + 꼼꼼한 RLS 정책이 필요하다는 점을 반드시 고려할 것.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
