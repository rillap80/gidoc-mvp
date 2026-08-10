/**
 * 외부 차트 라이브러리 없이 SVG로 그리는 경량 라인 차트.
 * "무겁게 만들지 않는다" 원칙에 따라 recharts 등을 새로 추가하지 않았다.
 */
interface MiniLineChartProps {
  values: number[];
  height?: number;
  color?: string;
}

export default function MiniLineChart({ values, height = 48, color = "#2FAE6B" }: MiniLineChartProps) {
  if (values.length === 0) return null;
  const width = 200;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
