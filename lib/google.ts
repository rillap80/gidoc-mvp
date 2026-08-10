import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

/**
 * STEP1 연동 방식 안내 (택 1):
 * A) Google Apps Script 트리거 방식 (권장, 가장 단순)
 *    Form이 연결된 스프레드시트에서 확장프로그램 > Apps Script로
 *    onFormSubmit(e) 트리거를 만들고, 응답이 들어올 때마다
 *    fetch(`${SITE_URL}/api/webhook/google-form`, { method: "POST", ... }) 로
 *    회사명/대표자명 + GOOGLE_FORM_WEBHOOK_SECRET 을 포함해 POST 호출.
 * B) 폴링 방식: Vercel/Netlify Scheduled Function이 주기적으로
 *    Sheets API로 새 행을 확인 (아래 fetchLatestUnprocessedRows).
 * 두 방식 다 지원하도록 아래 함수들을 제공한다.
 */

export async function fetchLatestUnprocessedRows() {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "Form Responses 1!A:E", // 실제 시트/컬럼 구조에 맞춰 조정
  });
  return res.data.values ?? [];
}

// STEP11: 최종 결과를 다시 시트에 기록 (상태 추적용)
export async function appendResultToSheet(row: (string | number)[]) {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "Results!A:Z",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

// STEP11: 심층 PDF를 Drive에 저장하고 공유 링크 반환
export async function uploadPdfToDrive(
  fileName: string,
  pdfBuffer: Buffer
): Promise<string> {
  const drive = google.drive({ version: "v3", auth: getAuth() });

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id",
  });

  const fileId = file.data.id!;
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}
