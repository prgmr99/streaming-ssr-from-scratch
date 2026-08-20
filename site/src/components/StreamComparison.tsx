import { useEffect, useRef, useState } from "react";

/**
 * 세 가지 방식을 나란히 재생한다.
 *
 * 실측값:
 *   renderToString    TTFB 0.005s / Total 0.005s / 목록 없음
 *   한 번에 보내기      TTFB 0.003s / Total 2.007s / 목록 있음
 *   스트리밍           TTFB 0.006s / Total 2.013s / 목록 있음
 *
 * 숫자만 보면 renderToString이 가장 빠르다. 그런데 목록이 없다.
 * 빠른 것이 아니라 데이터를 포기한 것이다.
 */

const DURATION = 2400; // 재생 총 길이(ms)
const ABORT_AT = 5; // renderToString이 Suspense를 포기하는 시점
const SHELL_AT = 6; // 스트리밍 shell 도착
const CONTENT_AT = 2010; // Suspense 내부 도착

const SPEEDS = [0.5, 1, 2] as const;

type Screen = "blank" | "stuck" | "shell" | "content";

export default function StreamComparison() {
  const [elapsed, setElapsed] = useState(DURATION);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!playing) return;

    startedAtRef.current = performance.now();
    baseRef.current = elapsed;

    const tick = (now: number) => {
      const next = baseRef.current + (now - startedAtRef.current) * speed;

      if (next >= DURATION) {
        setElapsed(DURATION);
        setPlaying(false);
        return;
      }

      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // elapsed는 의도적으로 제외 — 매 프레임 effect가 재실행되면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const play = () => {
    if (elapsed >= DURATION) setElapsed(0);
    setPlaying(true);
  };
  const replay = () => {
    setElapsed(0);
    setPlaying(true);
  };

  const seconds = (elapsed / 1000).toFixed(3);
  const progress = (elapsed / DURATION) * 100;

  // 각 방식이 지금 화면에 무엇을 그리고 있는가
  const stringScreen: Screen = elapsed >= ABORT_AT ? "stuck" : "blank";
  const bufferedScreen: Screen = elapsed >= CONTENT_AT ? "content" : "blank";
  const streamedScreen: Screen =
    elapsed >= CONTENT_AT ? "content" : elapsed >= SHELL_AT ? "shell" : "blank";

  return (
    <div className="sc">
      <style>{CSS}</style>

      {/* ── 조작부 ────────────────────────────── */}
      <div className="sc-bar">
        <button
          className="sc-btn"
          onClick={playing ? () => setPlaying(false) : play}
          aria-label={playing ? "일시정지" : "재생"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <button className="sc-btn sc-btn--ghost" onClick={replay}>
          처음부터
        </button>

        <span className="sc-clock">{seconds}s</span>

        <div className="sc-speeds" role="group" aria-label="재생 속도">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`sc-speed ${speed === s ? "is-on" : ""}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* ── 시간축 ────────────────────────────── */}
      <div className="sc-track">
        <div className="sc-fill" style={{ width: `${progress}%` }} />
        <div className="sc-head" style={{ left: `${progress}%` }} />

        <Marker
          at={SHELL_AT}
          label="shell"
          tone="shell"
          on={elapsed >= SHELL_AT}
        />
        <Marker
          at={CONTENT_AT}
          label="콘텐츠"
          tone="arrived"
          on={elapsed >= CONTENT_AT}
        />
      </div>

      {/* ── 세 화면 ───────────────────────────── */}
      <div className="sc-grid">
        <Panel
          title="renderToString"
          note="동기 함수. Suspense를 기다릴 수 없다"
          screen={stringScreen}
          ttfb="0.005s"
          total="0.005s"
          hasData={false}
        />
        <Panel
          title="한 번에 보내기"
          note="완성된 HTML을 다 만든 뒤 전송"
          screen={bufferedScreen}
          ttfb="0.003s"
          total="2.007s"
          hasData
        />
        <Panel
          title="스트리밍"
          note="shell을 먼저, 나머지는 나중에"
          screen={streamedScreen}
          ttfb="0.006s"
          total="2.013s"
          hasData
          highlight
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */

function Marker({
  at,
  label,
  tone,
  on,
}: {
  at: number;
  label: string;
  tone: "shell" | "arrived";
  on: boolean;
}) {
  return (
    <div
      className={`sc-marker sc-marker--${tone} ${on ? "is-on" : ""}`}
      style={{ left: `${(at / DURATION) * 100}%` }}
    >
      <span className="sc-tick" />
      <span className="sc-label">{label}</span>
    </div>
  );
}

function Panel({
  title,
  note,
  screen,
  ttfb,
  total,
  hasData,
  highlight = false,
}: {
  title: string;
  note: string;
  screen: Screen;
  ttfb: string;
  total: string;
  hasData: boolean;
  highlight?: boolean;
}) {
  return (
    <figure className={`sc-panel ${highlight ? "is-pick" : ""}`}>
      <figcaption className="sc-head-row">
        <code className="sc-title">{title}</code>
        <span className="sc-note">{note}</span>
      </figcaption>

      <div className="sc-screen">
        {screen === "blank" && <div className="sc-blank" />}

        {screen !== "blank" && (
          <>
            <div className="sc-h1">Todo List</div>

            {screen === "content" ? (
              <ul className="sc-list">
                <li>Buy groceries</li>
                <li>Read a book</li>
                <li>Write a blog post</li>
              </ul>
            ) : (
              <div className="sc-loading">loading...</div>
            )}

            {screen === "stuck" && (
              <div className="sc-stuck">여기서 멈춘다</div>
            )}
          </>
        )}
      </div>

      <dl className="sc-meta">
        <div>
          <dt>TTFB</dt>
          <dd>{ttfb}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>목록</dt>
          <dd className={hasData ? "sc-yes" : "sc-no"}>
            {hasData ? "포함" : "없음"}
          </dd>
        </div>
      </dl>
    </figure>
  );
}

/* ────────────────────────────────────────────── */

const CSS = `
.sc {
  font-family: var(--font-sans);
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  padding: 1.25rem;
}

.sc-bar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 1.5rem;
}

.sc-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.5rem 0.75rem;
  min-width: 2.5rem;
  border: 1px solid var(--ink);
  border-radius: 4px;
  background: var(--ink);
  color: var(--paper);
  cursor: pointer;
}

.sc-btn--ghost {
  background: transparent;
  color: var(--ink);
  border-color: var(--rule);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
}

.sc-btn--ghost:hover { border-color: var(--ink); }

.sc-clock {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  margin-left: 0.25rem;
}

.sc-speeds { margin-left: auto; display: flex; gap: 2px; }

.sc-speed {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 3px;
}

.sc-speed.is-on { color: var(--ink); border-color: var(--ink); font-weight: 700; }

/* 시간축 */
.sc-track {
  position: relative;
  height: 3px;
  background: #e4e2dd;
  border-radius: 2px;
  margin: 0 0 3rem;
}

.sc-fill {
  position: absolute; inset: 0 auto 0 0;
  background: var(--ink);
  border-radius: 2px;
}

.sc-head {
  position: absolute; top: 50%;
  width: 9px; height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
  background: var(--ink);
}

.sc-marker { position: absolute; top: 0; transform: translateX(-50%); }

.sc-tick {
  display: block;
  width: 1px; height: 14px;
  margin: -5px auto 0;
  background: var(--pending);
}

.sc-label {
  display: block;
  margin-top: 0.375rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  white-space: nowrap;
  color: var(--pending);
  transform: translateX(-50%);
  margin-left: 50%;
}

.sc-marker.is-on .sc-tick { width: 2px; }
.sc-marker.is-on .sc-label { font-weight: 700; }

.sc-marker--shell.is-on .sc-tick { background: var(--shell); }
.sc-marker--shell.is-on .sc-label { color: var(--shell); }
.sc-marker--arrived.is-on .sc-tick { background: var(--arrived); }
.sc-marker--arrived.is-on .sc-label { color: var(--arrived); }

/* 세 화면 */
.sc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.875rem;
}

@media (max-width: 52rem) {
  .sc-grid { grid-template-columns: 1fr; }
}

.sc-panel { margin: 0; }

.sc-head-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 0.5rem;
  min-height: 3rem;
}

.sc-title {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
}

.is-pick .sc-title { color: var(--arrived); }

.sc-note { font-size: 0.75rem; line-height: 1.45; color: var(--muted); }

.sc-screen {
  position: relative;
  height: 10.5rem;
  padding: 0.875rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
  overflow: hidden;
}

.is-pick .sc-screen { border-color: #c7cff5; }

.sc-blank { height: 100%; }

.sc-h1 { font-size: 0.9375rem; font-weight: 700; margin-bottom: 0.5rem; }

.sc-loading {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
}

.sc-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.8125rem;
  line-height: 1.65;
}

.sc-stuck {
  position: absolute;
  left: 0.875rem; bottom: 0.75rem;
  font-size: 0.6875rem;
  color: var(--pending);
  border-top: 1px dashed var(--pending);
  padding-top: 0.375rem;
  width: calc(100% - 1.75rem);
}

/* 측정 */
.sc-meta {
  margin: 0.5rem 0 0;
  border-top: 1px solid var(--rule);
}

.sc-meta > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.3125rem 0;
  border-bottom: 1px solid #eceae5;
}

.sc-meta > div:last-child { border-bottom: 0; }

.sc-meta dt { font-size: 0.6875rem; color: var(--muted); }

.sc-meta dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sc-yes { color: var(--arrived); font-weight: 700; }
.sc-no  { color: #b4342a; font-weight: 700; }
`;
