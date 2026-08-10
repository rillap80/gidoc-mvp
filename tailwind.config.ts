import type { Config } from "tailwindcss";

// 디자인 토큰 — "기업닥터" 브랜드
// 컨셉: 병원 차트/청진 리포트의 신뢰감 + 재무 데이터의 정밀함
// 팔레트: 딥 네이비(진단의 무게감) + 클리닉 화이트 + 바이탈 그린(건강/성장 시그널) + 앰버(주의 신호)
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1220", // 거의 검정에 가까운 네이비 — 헤드라인
          900: "#101A2E",
          800: "#182444",
          700: "#22315C",
        },
        vital: {
          50: "#EFFBF4",
          200: "#B8ECCB",
          400: "#4FCB86",
          500: "#2FAE6B", // 건강/성장 시그널 그린
          600: "#238C55",
        },
        amber: {
          400: "#F0A93B",
          500: "#DB8F1F", // 주의/리스크 시그널
        },
        paper: "#F7F8FA",
        line: "#E4E7ED",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,18,32,0.04), 0 8px 24px -8px rgba(11,18,32,0.10)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
