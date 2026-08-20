import { useState } from "react";

/**
 * $RC가 하는 일을 단계별로 분해한 시각화.
 *
 * 근본 제약: HTML은 위에서 아래로만 흐른다. 이미 보낸 부분은 고칠 수 없다.
 * 우회책: 완성된 조각을 문서 끝에 숨겨서 보내고, 작은 스크립트로 제자리에 옮긴다.
 *
 * 코드는 실측 응답에서 가져왔다.
 */

type StepId = "shell" | "arrive" | "move" | "done";

const STEPS: {
  id: StepId;
  time: string;
  title: string;
  detail: string;
}[] = [
  {
    id: "shell",
    time: "0.006s",
    title: "shell 도착",
    detail:
      "자리 표시자(B:0)와 fallback만 먼저 보낸다. 이 시점에 TodoList는 아직 완료되지 않았다.",
  },
  {
    id: "arrive",
    time: "2.010s",
    title: "콘텐츠가 문서 끝에 도착",
    detail:
      "HTML은 뒤에 덧붙이는 것만 가능하다. 그래서 완성된 목록을 문서 맨 끝에 hidden으로 보낸다. 아직 화면에는 보이지 않는다.",
  },
  {
    id: "move",
    time: "2.010s",
    title: "$RC 실행",
    detail:
      "브라우저는 script를 만나면 즉시 실행한다. S:0의 자식들을 B:0 자리로 옮긴다. getElementById와 insertBefore가 전부다.",
  },
  {
    id: "done",
    time: "2.010s",
    title: "교체 완료",
    detail:
      "fallback이 사라지고 목록이 제자리를 잡았다. 주석 마커도 미해결에서 해결로 바뀐다. 오른쪽 응답은 그대로다. 서버가 보낸 바이트는 변하지 않고, 바뀌는 것은 브라우저의 DOM뿐이다.",
  },
];

export default function RcAnimation() {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const showSlot = current.id === "shell" || current.id === "arrive";
  const showTail = current.id === "arrive" || current.id === "move";
  const flying = current.id === "move";
  const done = current.id === "done";

  return (
    <div className="rc">
      <style>{CSS}</style>

      {/* ── 단계 선택 ─────────────────────────── */}
      <ol className="rc-steps">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              className={`rc-step ${i === step ? "is-on" : ""} ${i < step ? "is-past" : ""}`}
              onClick={() => setStep(i)}
            >
              <span className="rc-step-time">{s.time}</span>
              <span className="rc-step-title">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="rc-body">
        {/* ── 문서 ─────────────────────────────── */}
        <div className="rc-doc">
          <span className="rc-doc-tag">브라우저가 보는 문서</span>

          <div className="rc-page">
            <div className="rc-h1">Todo List</div>

            {/* 자리 표시자 */}
            <div
              className={`rc-slot ${done ? "is-filled" : ""} ${flying ? "is-target" : ""}`}
            >
              <span className="rc-badges">
                <span className="rc-id">B:0</span>
                <span className={`rc-marker ${done ? "is-resolved" : ""}`}>
                  {done ? "<!--$-->" : "<!--$?-->"}
                  <span className="rc-marker-note">
                    {done ? "해결됨" : "미해결"}
                  </span>
                </span>
              </span>
              {done ? (
                <ul className="rc-list">
                  <li>Buy groceries</li>
                  <li>Read a book</li>
                  <li>Write a blog post</li>
                </ul>
              ) : (
                <span className="rc-fallback">loading...</span>
              )}
            </div>

            <div className="rc-rest">
              <span />
              <span />
            </div>

            {/* 문서 끝에 도착한 조각 */}
            {showTail && (
              <div className={`rc-tail ${flying ? "is-flying" : ""}`}>
                <span className="rc-id">S:0</span>
                <span className="rc-hidden-tag">hidden</span>
                <ul className="rc-list rc-list--dim">
                  <li>Buy groceries</li>
                  <li>Read a book</li>
                  <li>Write a blog post</li>
                </ul>
              </div>
            )}

            {flying && (
              <div className="rc-arrow" aria-hidden="true">
                ↑
              </div>
            )}
          </div>

          {!showSlot && !showTail && !done && null}
        </div>

        {/* ── 응답 원문 ────────────────────────── */}
        <div className="rc-code">
          <span className="rc-doc-tag">서버가 보낸 응답</span>

          <pre>
            <Line on={true}>{`<div id="root">`}</Line>
            <Line on={true}>{`  <h1>Todo List</h1>`}</Line>
            <Line on={true} hl={current.id === "shell"}>
              {`  <!--$?--><template id="B:0"></template>`}
            </Line>
            <Line on={true} hl={current.id === "shell"}>
              {`  <div>loading...</div><!--/$-->`}
            </Line>
            <Line on={true}>{`</div>`}</Line>
            <Line on={showTail || done} hl={current.id === "arrive"}>
              {`<div hidden id="S:0">`}
            </Line>
            <Line on={showTail || done} hl={current.id === "arrive"}>
              {`  <ul><li>Buy groceries</li>...</ul>`}
            </Line>
            <Line on={showTail || done} hl={current.id === "arrive"}>
              {`</div>`}
            </Line>
            <Line on={flying || done} hl={current.id === "move"}>
              {`<script>$RC("B:0","S:0")</script>`}
            </Line>
          </pre>

          {current.id === "move" && (
            <div className="rc-fn">
              <span className="rc-fn-label">$RC가 하는 일</span>
              <pre className="rc-fn-code">{`const slot    = getElementById("B:0")
const content = getElementById("S:0")

// fallback 제거 후 자식들을 옮긴다
slot.replaceWith(...content.children)`}</pre>
            </div>
          )}
        </div>
      </div>

      {/* ── 설명 ─────────────────────────────── */}
      <p className="rc-detail">{current.detail}</p>

      <div className="rc-nav">
        <button
          className="rc-btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← 이전
        </button>
        <span className="rc-count">
          {step + 1} / {STEPS.length}
        </span>
        <button
          className="rc-btn"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

function Line({
  children,
  on,
  hl = false,
}: {
  children: string;
  on: boolean;
  hl?: boolean;
}) {
  if (!on) return null;
  return <div className={`rc-line ${hl ? "is-hl" : ""}`}>{children}</div>;
}

/* ────────────────────────────────────────────── */

const CSS = `
.rc {
  font-family: var(--font-sans);
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  padding: 1.25rem;
}

/* 단계 선택 */
.rc-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  counter-reset: none;
}

@media (max-width: 44rem) {
  .rc-steps { grid-template-columns: repeat(2, 1fr); }
}

.rc-steps li { margin: 0; }

.rc-step {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.rc-step:hover { border-color: var(--muted); }

.rc-step.is-past { border-color: #cfcdc7; }

.rc-step.is-on {
  border-color: var(--ink);
  background: var(--surface);
}

.rc-step-time {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.rc-step-title {
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--muted);
}

.rc-step.is-on .rc-step-title { color: var(--ink); font-weight: 700; }
.rc-step.is-on .rc-step-time { color: var(--arrived); }

/* 본체 */
.rc-body {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 48rem) {
  .rc-body { grid-template-columns: 1fr; }
}

.rc-doc-tag {
  display: block;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.375rem;
}

.rc-page {
  position: relative;
  min-height: 15rem;
  padding: 0.875rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
}

.rc-h1 { font-size: 0.9375rem; font-weight: 700; margin-bottom: 0.625rem; }

/* 자리 표시자 */
.rc-slot {
  position: relative;
  padding: 0.625rem 0.75rem;
  border: 1px dashed var(--pending);
  border-radius: 4px;
  transition: border-color .25s, background .25s;
}

.rc-slot.is-target {
  border-color: var(--arrived);
  background: #eef2ff;
}

.rc-slot.is-filled {
  border-style: solid;
  border-color: var(--arrived);
  background: var(--surface);
}

.rc-id {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  padding: 1px 5px;
  border-radius: 3px;
  background: #e9e7e2;
  color: var(--muted);
  margin-bottom: 0.375rem;
}

.rc-slot.is-filled .rc-id,
.rc-slot.is-target .rc-id { background: var(--arrived); color: #fff; }

/* 주석 마커 상태 — 응답이 아니라 DOM에서 바뀐다 */
.rc-badges {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.rc-marker {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px dashed var(--pending);
  color: var(--pending);
  transition: color .25s, border-color .25s;
}

.rc-marker.is-resolved {
  border-style: solid;
  border-color: var(--arrived);
  color: var(--arrived);
}

.rc-marker-note {
  font-family: var(--font-sans);
  font-size: 0.625rem;
}

@media (prefers-reduced-motion: reduce) {
  .rc-marker { transition: none; }
}

.rc-fallback {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
}

.rc-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.8125rem;
  line-height: 1.65;
}

.rc-list--dim { color: var(--muted); }

/* 문서 나머지 (생략 표시) */
.rc-rest {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0.75rem 0;
}

.rc-rest span {
  height: 5px;
  border-radius: 3px;
  background: #eceae5;
}

.rc-rest span:first-child { width: 85%; }
.rc-rest span:last-child { width: 60%; }

/* 문서 끝 조각 */
.rc-tail {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: #faf9f6;
  transition: opacity .25s, transform .25s;
}

.rc-tail.is-flying {
  opacity: .35;
  transform: translateY(-4px);
}

.rc-hidden-tag {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--pending);
  margin-left: 0.375rem;
}

.rc-arrow {
  position: absolute;
  right: 1.25rem;
  top: 4.5rem;
  bottom: 3rem;
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  color: var(--arrived);
}

/* 코드 */
.rc-code pre {
  margin: 0;
  padding: 0.875rem;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.7;
  overflow-x: auto;
}

.rc-line {
  white-space: pre;
  border-radius: 2px;
  padding: 0 3px;
  margin: 0 -3px;
  color: var(--muted);
}

.rc-line.is-hl {
  background: #eef2ff;
  color: var(--ink);
  font-weight: 500;
}

.rc-fn { margin-top: 0.625rem; }

.rc-fn-label {
  display: block;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--arrived);
  margin-bottom: 0.375rem;
}

.rc-fn-code {
  font-size: 0.6875rem !important;
  color: var(--ink) !important;
}

/* 설명 + 이동 */
.rc-detail {
  margin: 1.125rem 0 1rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--ink);
  min-height: 3rem;
}

.rc-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rc-btn {
  font-family: inherit;
  font-size: 0.8125rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.rc-btn:hover:not(:disabled) { border-color: var(--ink); }
.rc-btn:disabled { opacity: .35; cursor: default; }

.rc-count {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: auto;
}

@media (prefers-reduced-motion: reduce) {
  .rc-slot, .rc-tail { transition: none; }
}
`;
