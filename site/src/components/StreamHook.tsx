import { useEffect, useRef, useState } from "react";

/**
 * 도입부용.
 *
 * 숫자도 API 이름도 없다. "같은 데이터인데 화면이 왜 다른가"라는
 * 질문만 남기는 것이 목적이다. 답은 본문에서 하나씩 푼다.
 *
 * 무한 반복 재생. 끝 상태를 잠시 보여준 뒤 처음으로 돌아간다.
 */

const DURATION = 2600; // 한 바퀴 재생 길이
const HOLD = 1400; // 끝난 뒤 머무는 시간
const CYCLE = DURATION + HOLD;

const SHELL_AT = 6;
const CONTENT_AT = 2010;

export default function StreamHook() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const rafRef = useRef<number | null>(null);
  const originRef = useRef(0);

  // 모션을 줄이는 설정이면 자동 재생하지 않고 완료 상태로 둔다
  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      setRunning(false);
      setElapsed(DURATION);
    }
  }, []);

  useEffect(() => {
    if (!running) return;

    // 멈췄다 다시 켤 때 지금 위치에서 이어지도록 원점을 잡는다
    originRef.current = performance.now() - elapsed;

    const tick = (now: number) => {
      const pos = (now - originRef.current) % CYCLE;

      // HOLD 구간에서는 마지막 프레임을 유지한다
      setElapsed(pos > DURATION ? DURATION : pos);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // elapsed는 의도적으로 제외 — 매 프레임 effect가 재실행되면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const progress = (elapsed / DURATION) * 100;
  const seconds = (elapsed / 1000).toFixed(1);

  const plain = elapsed >= CONTENT_AT ? "content" : "blank";
  const streamed =
    elapsed >= CONTENT_AT ? "content" : elapsed >= SHELL_AT ? "shell" : "blank";

  return (
    <div className="hk">
      <style>{CSS}</style>

      <div className="hk-screens">
        <Screen label="SSR" state={plain} />
        <Screen label="Streaming SSR" state={streamed} accent />
      </div>

      <div className="hk-bar">
        <button
          className="hk-toggle"
          onClick={() => setRunning((v) => !v)}
          aria-label={running ? "재생 멈춤" : "재생"}
        >
          {running ? "❚❚" : "▶"}
        </button>

        <div className="hk-track">
          <div className="hk-fill" style={{ width: `${progress}%` }} />
        </div>

        <span className="hk-clock">{seconds}s</span>
      </div>

      <p className="hk-caption">
        서버가 보내는 데이터는 같다. 다른 것은 <strong>언제 보내느냐</strong>
        뿐이다.
      </p>
    </div>
  );
}

function Screen({
  label,
  state,
  accent = false,
}: {
  label: string;
  state: "blank" | "shell" | "content";
  accent?: boolean;
}) {
  return (
    <figure className={`hk-panel ${accent ? "is-accent" : ""}`}>
      <div className="hk-view">
        {state !== "blank" && (
          <>
            <div className="hk-h1">Todo List</div>
            {state === "content" ? (
              <ul className="hk-list">
                <li>Buy groceries</li>
                <li>Read a book</li>
                <li>Write a blog post</li>
              </ul>
            ) : (
              <div className="hk-loading">loading...</div>
            )}
          </>
        )}
      </div>
      <figcaption className="hk-label">{label}</figcaption>
    </figure>
  );
}

const CSS = `
.hk { font-family: var(--font-sans); }

.hk-screens {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 34rem) {
  .hk-screens { grid-template-columns: 1fr; }
}

.hk-panel { margin: 0; }

.hk-view {
  height: 11rem;
  padding: 1.125rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
  overflow: hidden;
}

.hk-panel.is-accent .hk-view { border-color: #c7cff5; }

.hk-h1 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.hk-loading {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--muted);
}

.hk-list {
  margin: 0;
  padding-left: 1.125rem;
  font-size: 0.875rem;
  line-height: 1.7;
}

.hk-label {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
}

.hk-panel.is-accent .hk-label { color: var(--arrived); font-weight: 700; }

/* 조작부 */
.hk-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.hk-toggle {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  line-height: 1;
  padding: 0.4375rem 0.5625rem;
  min-width: 2rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.hk-toggle:hover { border-color: var(--ink); color: var(--ink); }

.hk-track {
  flex: 1;
  height: 2px;
  background: #e4e2dd;
  border-radius: 2px;
  overflow: hidden;
}

.hk-fill {
  height: 100%;
  background: var(--ink);
}

.hk-clock {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: right;
}

.hk-caption {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  color: var(--muted);
  text-align: center;
}

.hk-caption strong { color: var(--ink); }
`;
