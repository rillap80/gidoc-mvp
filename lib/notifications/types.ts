/**
 * 알림 Provider 교체 가능 구조.
 *
 * 원칙: 알림 발송 실패가 절대 파이프라인(AI 분석/저장)을 중단시키면 안 된다.
 * 이 인터페이스를 구현하는 Provider는 실패 시 예외를 던지기만 하면 되고,
 * "실패를 삼키고 로그만 남기는" 책임은 lib/notifications/index.ts의 notify() 함수가 진다.
 */

export interface NotificationLink {
  label: string; // 버튼/링크에 표시할 문구 (예: "관리자 열기", "PDF 보기", "상담 시작")
  url: string;
}

export type NotificationEvent = "new_application" | "report_completed" | "deep_report_completed";

export interface NotificationPayload {
  event: NotificationEvent;
  applicationId: string;
  companyName: string;
  ceoName: string;
  phone?: string; // 1차 정보 입력 단계에는 보통 없음 (심층 인증 단계에서만 수집됨)
  bizRegNo?: string;
  receivedAt: string; // ISO 8601
  healthScore?: number;
  riskGrade?: string;
  links: NotificationLink[];
}

export interface NotificationProvider {
  /** 사람이 읽을 수 있는 provider 이름 — 로그에 남는다 (예: "slack", "telegram") */
  readonly name: string;
  /** 실패 시 예외를 던진다. 여기서 실패를 삼키지 않는다 — 호출부(notify())가 로깅을 책임진다. */
  send(payload: NotificationPayload): Promise<void>;
}
