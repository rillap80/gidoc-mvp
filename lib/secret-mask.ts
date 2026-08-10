/**
 * 에러 메시지나 로그 문자열에 실수로 자격증명 원문이 섞여 나가는 것을 막는 마지막 방어선.
 *
 * 원칙: CRETOP_ID / CRETOP_PASSWORD는 어떤 코드에서도 로그·에러 메시지에 직접 넣지 않는다.
 * 그럼에도 Playwright가 던지는 예외 메시지(예: 잘못된 URL, 브라우저 콘솔 로그 등)에
 * 우연히 포함될 가능성을 0으로 만들기 위해, 로깅 직전에 실제 시크릿 값을 한 번 더 치환한다.
 */
export function maskSecrets(text: string, secrets: (string | undefined)[]): string {
  let result = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 3) continue; // 너무 짧은 값은 오탐(일반 단어 마스킹) 방지로 제외
    result = result.split(secret).join("***");
  }
  return result;
}

/** CRETOP_ID / CRETOP_PASSWORD 전용 단축 헬퍼 */
export function maskCretopCredentials(text: string): string {
  return maskSecrets(text, [process.env.CRETOP_ID, process.env.CRETOP_PASSWORD]);
}
