import { useEffect, useRef, useState } from "react";

/**
 * 한 번에 보내기 vs 스트리밍 비교.
 *
 * 실측값 기준 (2단계 버퍼링 실험):
 *   - 버퍼링:   2.007s 시점에 전부 도착
 *   - 스트리밍: 0.006s에 shell, 2.013s에 콘텐츠
 *
 * 두 방식이 보내는 바이트는 같다. 다른 것은 언제 보내느냐뿐이고,
 * 그 차이는 사용자 화면에서만 드러난다.
 */

const DURATION = 2400; // 재생 총 길이(ms)
const SHELL_AT = 6; // shell 도착
const CONTENT_AT = 2010; // Suspense 내부 도착

const SPEEDS = [0.5, 1, 2] as const;

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
    // elapsed는 의도적으로 제외 — 재생 중 매 프레임 effect가 재실행되면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const play = () => {
    if (elapsed >= DURATION) setElapsed(0);
    setPlaying(true);
  };

  const pause = () => setPlaying(false);
  const replay = () => {
    setElapsed(0);
    setPlaying(true);
  };

  const seconds = (elapsed / 1000).toFixed(3);
  const progress = (elapsed / DURATION) * 100;

  // 각 방식이 현재 시점에 화면에 무엇을 그리고 있는가
  const bufferedState = elapsed >= CONTENT_AT ? "content" : "blank";
  const streamedState =
    elapsed >= CONTENT_AT ? "content" : elapsed >= SHELL_AT ? "shell" : "blank";

  return (
    <div className="sc">
      <style>{CSS}</style>

      {/* ── 조작부 ────────────────────────────── */}
      <div className="sc-bar">
        <button
          className="sc-btn"
          onClick={playing ? pause : play}
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
          active={elapsed >= SHELL_AT}
        />
        <Marker
          at={CONTENT_AT}
          label="콘텐츠"
          tone="arrived"
          active={elapsed >= CONTENT_AT}
        />
      </div>

      {/* ── 두 화면 ───────────────────────────── */}
      <div className="sc-grid">
        <Panel
          title="한 번에 보내기"
          note="완성된 HTML을 다 만든 뒤 전송"
          state={bufferedState}
          firstPaint={elapsed >= CONTENT_AT ? "2.010s" : null}
        />
        <Panel
          title="스트리밍"
          note="shell을 먼저 보내고 나머지는 나중에"
          state={streamedState}
          firstPaint={elapsed >= SHELL_AT ? "0.006s" : null}
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
  active,
}: {
  at: number;
  label: string;
  tone: "shell" | "arrived";
  active: boolean;
}) {
  return (
    <div
      className={`sc-marker sc-marker--${tone} ${active ? "is-on" : ""}`}
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
  state,
  firstPaint,
}: {
  title: string;
  note: string;
  state: "blank" | "shell" | "content";
  firstPaint: string | null;
}) {
  return (
    <figure className="sc-panel">
      <figcaption className="sc-head-row">
        <span className="sc-title">{title}</span>
        <span className="sc-note">{note}</span>
      </figcaption>

      <div className="sc-screen">
        {state === "blank" && <div className="sc-blank" />}

        {state !== "blank" && (
          <>
            <div className="sc-h1">Todo List</div>
            {state === "shell" ? (
              <div className="sc-loading">loading...</div>
            ) : (
              <ul className="sc-list">
                <li>Buy groceries</li>
                <li>Read a book</li>
                <li>Write a blog post</li>
              </ul>
            )}
          </>
        )}
      </div>

      <div className="sc-meta">
        <span>첫 화면</span>
        <strong>{firstPaint ?? "—"}</strong>
      </div>
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

.sc-speed.is-on {
  color: var(--ink);
  border-color: var(--ink);
  font-weight: 700;
}

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

.sc-marker {
  position: absolute; top: 0;
  transform: translateX(-50%);
}

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

.sc-marker--shell.is-on .sc-tick,
.sc-marker--shell.is-on .sc-label { background: var(--shell); color: var(--shell); }
.sc-marker--shell.is-on .sc-label { background: none; }

.sc-marker--arrived.is-on .sc-tick { background: var(--arrived); }
.sc-marker--arrived.is-on .sc-label { color: var(--arrived); }

/* 두 화면 */
.sc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 40rem) {
  .sc-grid { grid-template-columns: 1fr; }
}

.sc-panel { margin: 0; }

.sc-head-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
}

.sc-title { font-size: 0.9375rem; font-weight: 700; }
.sc-note { font-size: 0.75rem; color: var(--muted); }

.sc-screen {
  height: 11rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
  overflow: hidden;
}

.sc-blank { height: 100%; }

.sc-h1 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.sc-loading {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--muted);
}

.sc-list {
  margin: 0;
  padding-left: 1.125rem;
  font-size: 0.875rem;
  line-height: 1.7;
}

.sc-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--rule);
  font-size: 0.75rem;
  color: var(--muted);
}

.sc-meta strong {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
`;
