/**
 * CRETOP 자동화 파이프라인에서 발생 가능한 실패를 원인별로 구분한다.
 * 모두 retryWithBackoff의 재시도 대상이지만, 관리자 페이지 로그에서 원인을
 * 한눈에 구분할 수 있도록 이름을 분리했다 (예: 로그인 실패가 반복되면 자격증명 문제,
 * 타임아웃이 반복되면 네트워크/사이트 부하 문제로 원인을 좁힐 수 있다).
 */

export class CretopLoginError extends Error {
  constructor(message = "CRETOP 로그인에 실패했습니다.") {
    super(message);
    this.name = "CretopLoginError";
  }
}

export class CretopSessionExpiredError extends Error {
  constructor(message = "CRETOP 세션이 만료되었습니다.") {
    super(message);
    this.name = "CretopSessionExpiredError";
  }
}

export class CretopCompanyNotFoundError extends Error {
  constructor(message = "CRETOP에서 기업을 찾을 수 없습니다.") {
    super(message);
    this.name = "CretopCompanyNotFoundError";
  }
}

export class CretopNoDataError extends Error {
  constructor(message = "CRETOP에 등록된 재무데이터가 없습니다.") {
    super(message);
    this.name = "CretopNoDataError";
  }
}

export class CretopNetworkError extends Error {
  constructor(message = "CRETOP 접속 중 네트워크 오류가 발생했습니다.") {
    super(message);
    this.name = "CretopNetworkError";
  }
}

/** 위 에러 중 무엇에 해당하는지 원본 에러로부터 분류 — 알 수 없으면 CretopNetworkError로 처리 */
export function classifyPlaywrightError(err: unknown): Error {
  if (
    err instanceof CretopLoginError ||
    err instanceof CretopSessionExpiredError ||
    err instanceof CretopCompanyNotFoundError ||
    err instanceof CretopNoDataError ||
    err instanceof CretopNetworkError
  ) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(message)) return new CretopNetworkError(`타임아웃: ${message}`);
  if (/net::|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message)) {
    return new CretopNetworkError(`네트워크 오류: ${message}`);
  }
  return new CretopNetworkError(message);
}
