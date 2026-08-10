import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";

/**
 * 카카오 알림톡은 문자와 달리:
 * 1) 카카오 비즈니스 채널 + 발송대행사(NHN Toast, Solapi, Bizmsg 등) 계약이 필요하고
 * 2) 메시지 문구/버튼이 사전 승인된 "템플릿" 형태로만 발송 가능하다 (자유 텍스트 불가).
 * 그래서 이 Provider는 실제로는 "템플릿 코드 + 치환 변수"를 채워 넣는 방식으로 구현해야 하며,
 * 발송사와 계약 후 템플릿이 승인되면 TEMPLATE_CODE와 변수 매핑만 채우면 된다.
 */
export class KakaoNotificationProvider implements NotificationProvider {
  readonly name = "kakao";

  async send(payload: NotificationPayload): Promise<void> {
    const apiKey = process.env.KAKAO_ALIMTALK_API_KEY;
    const senderKey = process.env.KAKAO_ALIMTALK_SENDER_KEY; // 카카오 비즈니스 채널 발신 프로필 키
    const templateCode = process.env.KAKAO_ALIMTALK_TEMPLATE_CODE;
    const adminPhone = process.env.ADMIN_NOTIFICATION_PHONE;

    if (!apiKey || !senderKey || !templateCode || !adminPhone) {
      throw new Error(
        "KAKAO_ALIMTALK_API_KEY/SENDER_KEY/TEMPLATE_CODE/ADMIN_NOTIFICATION_PHONE이 설정되지 않았습니다."
      );
    }

    // TODO: 실제 발송사 API 연동. 예시(의사코드, Solapi 스타일):
    // const res = await fetch("https://api.solapi.com/messages/v4/send", {
    //   method: "POST",
    //   headers: { Authorization: `HMAC-SHA256 ...`, "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     message: {
    //       to: adminPhone,
    //       from: process.env.ADMIN_NOTIFICATION_SENDER_NUMBER,
    //       kakaoOptions: {
    //         pfId: senderKey,
    //         templateId: templateCode,
    //         variables: {
    //           "#{회사명}": payload.companyName,
    //           "#{대표명}": payload.ceoName,
    //           "#{링크}": payload.links[0]?.url ?? "",
    //         },
    //         buttons: payload.links.map((l) => ({ buttonType: "WL", buttonName: l.label, linkMo: l.url, linkPc: l.url })),
    //       },
    //     },
    //   }),
    // });
    // if (!res.ok) throw new Error(`알림톡 발송 실패: ${res.status}`);
    throw new Error("카카오 알림톡 Provider가 아직 실제 발송사와 연동되지 않았습니다 (TODO).");
  }
}
