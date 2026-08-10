import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Svg,
  Circle,
  Rect,
} from "@react-pdf/renderer";
import type { RiskGrade, ScoreBreakdown, StarRatings } from "@/types";

/**
 * STEP10 심층보고서 PDF — 맥킨지/딜로이트 스타일
 * (표 / 게이지 / 막대그래프 / 리스크 색상 / 아이콘, A4 인쇄 최적화)
 */

const COLOR = {
  ink: "#0B1220",
  inkSoft: "#5B6472",
  line: "#E4E7ED",
  vital: "#2FAE6B",
  amber: "#DB8F1F",
  red: "#D64545",
  paper: "#F7F8FA",
};

const GRADE_COLOR: Record<RiskGrade, string> = {
  A: COLOR.vital,
  B: COLOR.vital,
  C: COLOR.amber,
  D: COLOR.amber,
  E: COLOR.red,
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: COLOR.ink },

  // 표지 헤더
  coverHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  brand: { fontSize: 9, color: COLOR.inkSoft, letterSpacing: 1 },
  h1: { fontSize: 22, marginTop: 4, color: COLOR.ink },
  sub: { fontSize: 10, color: COLOR.inkSoft, marginTop: 2 },

  gradeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, alignItems: "center" },
  gradeBadgeText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Helvetica-Bold" },
  gradeBadgeLabel: { color: "#FFFFFF", fontSize: 7, marginTop: 1 },

  // 카드 공통
  card: { backgroundColor: "#FFFFFF", borderRadius: 6, border: `1pt solid ${COLOR.line}`, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, color: COLOR.ink },

  row: { flexDirection: "row" },
  colGap: { marginRight: 14 },

  // 표
  table: { borderTop: `1pt solid ${COLOR.line}` },
  tr: { flexDirection: "row", borderBottom: `1pt solid ${COLOR.line}`, paddingVertical: 5 },
  th: { flex: 1, fontSize: 8, color: COLOR.inkSoft },
  td: { flex: 1, fontSize: 9, color: COLOR.ink },
  tdRight: { flex: 1, fontSize: 9, color: COLOR.ink, textAlign: "right" },

  // 섹션 (좌측 컬러바 + 본문)
  section: { flexDirection: "row", marginBottom: 10 },
  sectionBar: { width: 3, marginRight: 8, borderRadius: 2 },
  sectionBody: { flex: 1 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sectionText: { fontSize: 9, color: COLOR.inkSoft, lineHeight: 1.5 },

  adviceBox: {
    backgroundColor: COLOR.ink,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  adviceLabel: { color: COLOR.vital, fontSize: 8, letterSpacing: 1, marginBottom: 6 },
  adviceText: { color: "#FFFFFF", fontSize: 12, lineHeight: 1.5, fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLOR.inkSoft,
    borderTop: `0.5pt solid ${COLOR.line}`,
    paddingTop: 6,
  },
});

// ── 반원 게이지 (0~100점) ────────────────────────────────
function ScoreGauge({ score, grade }: { score: number; grade: RiskGrade }) {
  const size = 110;
  const r = 46;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
const filled = circumference * (score / 100);
const gap = circumference - filled;

  return (
    <View style={{ alignItems: "center", width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} stroke={COLOR.line} strokeWidth={9} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={GRADE_COLOR[grade]}
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold" }}>{score}</Text>
      </View>
    </View>
  );
}

// ── 별점 막대그래프 ────────────────────────────────────────
const STAR_LABELS: Record<keyof StarRatings, string> = {
  finance: "재무",
  growth: "성장성",
  stability: "안정성",
  tax: "절세",
  gov_support: "정부지원",
  patent: "특허",
  labor: "노무",
};

function StarBarChart({ ratings }: { ratings: StarRatings }) {
  const keys = Object.keys(STAR_LABELS) as (keyof StarRatings)[];
  const barMaxWidth = 90;
  return (
    <View>
      {keys.map((key) => {
        const value = ratings[key];
        const barColor = value >= 4 ? COLOR.vital : value >= 3 ? COLOR.amber : COLOR.red;
        return (
          <View key={key} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Text style={{ width: 50, fontSize: 8, color: COLOR.inkSoft }}>{STAR_LABELS[key]}</Text>
            <Svg width={barMaxWidth} height={8}>
              <Rect x={0} y={0} width={barMaxWidth} height={8} fill={COLOR.line} rx={2} />
              <Rect x={0} y={0} width={(barMaxWidth * value) / 5} height={8} fill={barColor} rx={2} />
            </Svg>
            <Text style={{ marginLeft: 6, fontSize: 8, color: COLOR.ink }}>{value}/5</Text>
          </View>
        );
      })}
    </View>
  );
}

function fmtPercent(v: number | null): string {
  return v == null ? "데이터 없음" : `${v.toFixed(1)}%`;
}

interface DeepReportPdfProps {
  companyName: string;
  ceoName: string;
  healthScore: number;
  riskGrade: RiskGrade;
  scoreBreakdown: ScoreBreakdown;
  starRatings: StarRatings;
  oneLineAdvice: string;
  sections: { title: string; body: string }[];
  priorities: string[];
  actionPlan: string[];
}

function DeepReportDocument({
  companyName,
  ceoName,
  healthScore,
  riskGrade,
  scoreBreakdown,
  starRatings,
  oneLineAdvice,
  sections,
  priorities,
  actionPlan,
}: DeepReportPdfProps) {
  const today = new Date().toLocaleDateString("ko-KR");

  return (
    <Document>
      {/* ── 표지 겸 요약 페이지 ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverHeader}>
          <View>
            <Text style={styles.brand}>기업닥터 AI · 심층 건강검진 보고서</Text>
            <Text style={styles.h1}>{companyName}</Text>
            <Text style={styles.sub}>대표: {ceoName}  |  발행일: {today}</Text>
          </View>
          <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLOR[riskGrade] }]}>
            <Text style={styles.gradeBadgeText}>{riskGrade}</Text>
            <Text style={styles.gradeBadgeLabel}>RISK GRADE</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, styles.colGap, { width: 150, alignItems: "center" }]}>
            <Text style={styles.cardTitle}>기업 건강점수</Text>
            <ScoreGauge score={healthScore} grade={riskGrade} />
            <Text style={{ fontSize: 8, color: COLOR.inkSoft }}>/ 100점</Text>
          </View>

          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardTitle}>영역별 평가</Text>
            <StarBarChart ratings={starRatings} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>재무비율 산출 근거</Text>
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={styles.th}>지표</Text>
              <Text style={[styles.th, { textAlign: "right" }]}>값</Text>
            </View>
            {[
              ["매출성장률", fmtPercent(scoreBreakdown.revenue_growth_rate)],
              ["영업이익률", fmtPercent(scoreBreakdown.operating_margin)],
              ["부채비율", fmtPercent(scoreBreakdown.debt_ratio)],
              ["유동비율", fmtPercent(scoreBreakdown.current_ratio)],
              ["ROE(자기자본이익률)", fmtPercent(scoreBreakdown.roe)],
              ["ROA(총자산이익률)", fmtPercent(scoreBreakdown.roa)],
              [
                "영업현금흐름",
                scoreBreakdown.cashflow_positive == null
                  ? "데이터 없음"
                  : scoreBreakdown.cashflow_positive
                  ? "양(+)"
                  : "음(-)",
              ],
            ].map(([label, value]) => (
              <View key={label} style={styles.tr}>
                <Text style={styles.td}>{label}</Text>
                <Text style={styles.tdRight}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 7, color: COLOR.inkSoft, marginTop: 6 }}>
            {scoreBreakdown.notes} (데이터 완전성 {Math.round(scoreBreakdown.data_completeness * 100)}%)
          </Text>
        </View>

        <View style={styles.adviceBox}>
          <Text style={styles.adviceLabel}>대표님께 드리는 한 줄 조언</Text>
          <Text style={styles.adviceText}>{oneLineAdvice}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>기업닥터 AI · CONFIDENTIAL</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── 상세 분석 페이지 ── */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.h1, { fontSize: 16, marginBottom: 14 }]}>영역별 상세 분석</Text>

        {sections.map((s) => (
          <View key={s.title} style={styles.section} wrap={false}>
            <View style={[styles.sectionBar, { backgroundColor: COLOR.vital }]} />
            <View style={styles.sectionBody}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionText}>{s.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>우선순위</Text>
          {priorities.map((p, i) => (
            <Text key={i} style={{ fontSize: 9, marginBottom: 3 }}>
              {i + 1}. {p}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>실행전략</Text>
          {actionPlan.map((a, i) => (
            <Text key={i} style={{ fontSize: 9, marginBottom: 3 }}>
              • {a}
            </Text>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>기업닥터 AI · CONFIDENTIAL</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateDeepReportPdf(
  props: DeepReportPdfProps
): Promise<Buffer> {
  return renderToBuffer(<DeepReportDocument {...props} />);
}
