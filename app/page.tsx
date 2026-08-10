const GOOGLE_FORM_URL = "https://forms.gle/VZcMgd7BuvCaL3tU8";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-6">
            데이터 기반 기업 건강검진
          </p>
          <h1 className="font-display text-4xl md:text-6xl leading-[1.15] text-ink-950 mb-6">
            회사명과 대표자명만으로,
            <br />
            <span className="italic text-ink-700">3분 안에</span> 나오는 진단.
          </h1>
          <p className="text-base md:text-lg text-ink-700/80 mb-10 leading-relaxed">
            기업닥터 AI가 재무·성장성·정부지원·특허·노무 데이터를 분석해
            지금 우리 회사가 놓치고 있는 문제를 알려드립니다.
          </p>
          <a
            href={GOOGLE_FORM_URL}
            className="inline-flex items-center justify-center rounded-full bg-ink-950 text-white px-8 py-4 text-sm font-medium tracking-wide hover:bg-ink-800 transition-colors"
          >
            무료 기업 건강검진 받기
          </a>
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-700/60">
        사업자등록번호만으로 진단 · 서류 제출 없음 · 무료 · 시범 운영 중
      </footer>
    </main>
  );
}
