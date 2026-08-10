import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { HealthData } from "@/types";
import { maskCretopCredentials } from "@/lib/secret-mask";
import {
  CretopLoginError,
  CretopCompanyNotFoundError,
  CretopNoDataError,
  classifyPlaywrightError,
} from "@/lib/cretop-errors";

/**
 * STEP3~4: 사람이 직접 로그인해서 재무제표를 조회하는 과정을 그대로 자동화한다.
 *
 * ⚠️ 보안 원칙 (절대 위반 금지):
 * - CRETOP_ID / CRETOP_PASSWORD는 이 파일의 getCretopCredentials() 한 곳에서만 process.env로
 *   읽는다. 다른 어떤 모듈에도 문자열로 전달하거나 저장하지 않는다.
 * - 어떤 경우에도 console.log/console.error, logStep(), 예외 메시지에 자격증명 원문을
 *   그대로 넣지 않는다. 예외 메시지는 throw 하기 전에 maskCretopCredentials()를 거친다.
 * - .env.local / 배포 환경변수 외의 위치(코드, Git, DB)에는 절대 저장하지 않는다.
 *
 * ⚠️ 실행 전 반드시 확인:
 * 1) CRETOP 이용약관상 자동화(스크래핑) 허용 여부를 계약 담당자에게 먼저 확인할 것.
 * 2) 아래 SELECTORS는 실제 사이트(https://www.cretop.com) 구조를 이 환경에서 직접 열어볼 수
 *    없어 "표준적인 위치"를 가정한 자리표시자다. 반드시 로컬에서
 *      npx playwright codegen https://www.cretop.com
 *    로 실제 로그인/검색/재무 페이지를 열어보며 아래 값을 실제와 맞게 교체해야 동작한다.
 */

const SELECTORS = {
  loginIdInput: "#loginId",
  loginPwInput: "#loginPwd",
  loginSubmitBtn: "button[type='submit'].login-btn",
  loginErrorBanner: ".login-error-message", // 로그인 실패 시 뜨는 안내 문구
  postLoginMarker: "text=로그아웃", // 로그인 성공 후에만 나타나는 요소 (헤더의 "로그아웃" 링크 등)

  searchInput: "input.company-search-input",
  searchSubmitBtn: "button.company-search-btn",
  searchResultList: ".search-result-list li a",
  searchNoResult: ".search-no-result", // "검색 결과가 없습니다" 안내 영역

  financeTabLink: "a[href*='CMSRC04'], a:has-text('기업재무')",
  financeNoDataBanner: ".finance-no-data", // 재무데이터 없음 안내 영역

  overviewText: ".company-overview",
  industryText: ".company-industry",
  ceoText: ".company-ceo",
  foundedText: ".company-founded",
  revenueText: ".finance-table tr:has-text('매출액') td.value",
  revenuePrevYearText: ".finance-table tr:has-text('매출액') td.value-prev-year",
  operatingProfitText: ".finance-table tr:has-text('영업이익') td.value",
  netIncomeText: ".finance-table tr:has-text('당기순이익') td.value",
  assetsText: ".finance-table tr:has-text('자산총계') td.value",
  currentAssetsText: ".finance-table tr:has-text('유동자산') td.value",
  liabilitiesText: ".finance-table tr:has-text('부채총계') td.value",
  currentLiabilitiesText: ".finance-table tr:has-text('유동부채') td.value",
  equityText: ".finance-table tr:has-text('자본총계') td.value",
  operatingCashflowText: ".finance-table tr:has-text('영업활동현금흐름') td.value",
  creditGradeText: ".credit-grade-badge",

  pdfDownloadBtn: "a.btn-pdf-download, button:has-text('PDF 다운로드')",
} as const;

const ACTION_TIMEOUT_MS = 15_000; // 클릭/입력 등 단일 액션 대기 한도
const NAV_WAIT_TIMEOUT_MS = 20_000; // 검색/탭 이동 후 결과 요소가 나타나길 기다리는 한도

// =========================================================
// STEP2: 환경변수에서 자격증명 로드 — 이 함수 밖으로 값을 내보내지 않는다.
// =========================================================
function getCretopCredentials(): { id: string; password: string } {
  const id = process.env.CRETOP_ID;
  const password = process.env.CRETOP_PASSWORD;
  if (!id || !password) {
    throw new Error("CRETOP_ID/CRETOP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  return { id, password };
}

// =========================================================
// STEP3: Playwright 브라우저 실행
// =========================================================
async function launchCretopBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  return { browser, context, page };
}

// =========================================================
// STEP4: CRETOP 로그인 — 사람이 아이디/비밀번호를 입력하고 로그인 버튼을 누르는 흐름 그대로.
// Locator API는 요소가 나타나고(visible) 조작 가능해질(enabled/stable) 때까지 자동으로
// 기다리므로, waitForTimeout 같은 임의 대기나 waitForNavigation과의 Promise.race 없이도
// 안전하게 다음 상태를 기다릴 수 있다.
// =========================================================
async function loginToCretop(page: Page, id: string, password: string): Promise<void> {
  await page.goto("https://www.cretop.com/", { waitUntil: "domcontentloaded" });

  await page.locator(SELECTORS.loginIdInput).fill(id);
  await page.locator(SELECTORS.loginPwInput).fill(password);
  await page.locator(SELECTORS.loginSubmitBtn).click();

  // 로그인 성공(postLoginMarker 등장) 또는 실패(에러 배너 등장) 중 먼저 나타나는 쪽으로 분기.
  // Promise.race를 직접 쓰는 대신 Playwright의 Locator.or()로 "둘 중 하나가 보이면 진행"을
  // 표현한다 — Playwright 엔진이 폴링을 관리하므로 우리 쪽에서 레이스 컨디션을 만들 일이 없다.
  const success = page.locator(SELECTORS.postLoginMarker);
  const failure = page.locator(SELECTORS.loginErrorBanner);
  const outcome = success.or(failure);

  await outcome.first().waitFor({ state: "visible", timeout: NAV_WAIT_TIMEOUT_MS });

  if (await failure.isVisible().catch(() => false)) {
    const bannerText = await failure.innerText().catch(() => "");
    throw new CretopLoginError(`CRETOP 로그인 실패: ${bannerText || "아이디 또는 비밀번호를 확인하세요."}`);
  }
  if (!(await success.isVisible().catch(() => false))) {
    throw new CretopLoginError("CRETOP 로그인 결과를 확인할 수 없습니다 (셀렉터 확인 필요).");
  }
}

// =========================================================
// STEP5~6: 사업자번호(우선) 또는 회사명으로 기업 조회
// =========================================================
async function searchCompany(page: Page, query: string): Promise<void> {
  await page.locator(SELECTORS.searchInput).fill(query);
  await page.locator(SELECTORS.searchSubmitBtn).click();

  const results = page.locator(SELECTORS.searchResultList);
  const noResult = page.locator(SELECTORS.searchNoResult);
  await results.first().or(noResult).waitFor({ state: "visible", timeout: NAV_WAIT_TIMEOUT_MS });

  if (await noResult.isVisible().catch(() => false)) {
    throw new CretopCompanyNotFoundError(`CRETOP 검색 결과 없음: ${query}`);
  }

  await results.first().click();

  // 기업 상세 페이지 안의 "기업재무" 탭으로 이동 (있을 때만 — 이미 재무 탭이 기본일 수도 있음)
  const financeTab = page.locator(SELECTORS.financeTabLink);
  if (await financeTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await financeTab.first().click();
  }

  const financeNoData = page.locator(SELECTORS.financeNoDataBanner);
  if (await financeNoData.isVisible({ timeout: 3000 }).catch(() => false)) {
    throw new CretopNoDataError("CRETOP에 등록된 재무데이터가 없습니다.");
  }
}

async function textOrNull(page: Page, selector: string): Promise<string | null> {
  const locator = page.locator(selector).first();
  if (!(await locator.isVisible({ timeout: 2000 }).catch(() => false))) return null;
  const text = (await locator.innerText().catch(() => ""))?.trim();
  return text || null;
}

function toNumber(text: string | null): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[,원억만천\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// =========================================================
// STEP7: 화면에서 재무 원자료 추출
// =========================================================
async function extractRawFinancials(page: Page): Promise<Omit<HealthData, "source">> {
  return {
    overview: (await textOrNull(page, SELECTORS.overviewText)) ?? undefined,
    industry: (await textOrNull(page, SELECTORS.industryText)) ?? undefined,
    ceo: (await textOrNull(page, SELECTORS.ceoText)) ?? undefined,
    founded_at: (await textOrNull(page, SELECTORS.foundedText)) ?? undefined,
    revenue: toNumber(await textOrNull(page, SELECTORS.revenueText)),
    revenue_prev_year: toNumber(await textOrNull(page, SELECTORS.revenuePrevYearText)),
    operating_profit: toNumber(await textOrNull(page, SELECTORS.operatingProfitText)),
    net_income: toNumber(await textOrNull(page, SELECTORS.netIncomeText)),
    assets: toNumber(await textOrNull(page, SELECTORS.assetsText)),
    current_assets: toNumber(await textOrNull(page, SELECTORS.currentAssetsText)),
    liabilities: toNumber(await textOrNull(page, SELECTORS.liabilitiesText)),
    current_liabilities: toNumber(await textOrNull(page, SELECTORS.currentLiabilitiesText)),
    equity: toNumber(await textOrNull(page, SELECTORS.equityText)),
    operating_cashflow: toNumber(await textOrNull(page, SELECTORS.operatingCashflowText)),
    credit_grade: (await textOrNull(page, SELECTORS.creditGradeText)) ?? undefined,
  };
}

// =========================================================
// STEP8: 스크래핑 원자료 → HealthData로 변환.
// (지금은 필드가 거의 1:1이라 단순 조립이지만, 사이트 구조가 바뀌어 원자료 형태가 달라져도
//  이 함수 하나만 고치면 되도록 변환 지점을 분리해 두었다.)
// =========================================================
function toHealthData(raw: Omit<HealthData, "source">): HealthData {
  return { ...raw, source: "session_automation" };
}

async function attemptDownloadPdf(page: Page): Promise<Buffer | undefined> {
  const btn = page.locator(SELECTORS.pdfDownloadBtn).first();
  if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) return undefined;

  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      btn.click(),
    ]);
    const stream = await download.createReadStream();
    if (!stream) return undefined;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  } catch {
    // PDF 다운로드가 없거나 실패해도 텍스트 데이터는 이미 확보했으므로 파이프라인은 계속 진행
    return undefined;
  }
}

export interface CretopAutomationResult extends HealthData {
  pdfBuffer?: Buffer;
}

/**
 * STEP2~8 전체 오케스트레이션. 자격증명은 이 함수 내부에서만 env로 읽고,
 * 브라우저는 성공하든 실패하든 반드시 종료한다.
 */
export async function loginAndFetchFinancials(
  companyName: string,
  bizRegNo?: string
): Promise<CretopAutomationResult> {
  const { id, password } = getCretopCredentials();
  const { browser, page } = await launchCretopBrowser();

  try {
    await loginToCretop(page, id, password);
    await searchCompany(page, bizRegNo || companyName);
    const raw = await extractRawFinancials(page);
    const pdfBuffer = await attemptDownloadPdf(page);

    return { ...toHealthData(raw), pdfBuffer };
  } catch (err) {
    const classified = classifyPlaywrightError(err);
    // 방어적 마스킹: 원본 예외 메시지에 자격증명 원문이 우연히 포함돼 있어도 제거한다.
    classified.message = maskCretopCredentials(classified.message);
    throw classified;
  } finally {
    // 브라우저 종료는 성공/실패와 무관하게 반드시 실행 (리소스 누수 방지)
    await browser.close().catch(() => undefined);
  }
}
