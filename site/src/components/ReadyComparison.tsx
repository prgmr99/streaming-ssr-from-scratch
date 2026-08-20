import { useState } from "react";

/**
 * onShellReady vs onAllReady.
 *
 * 한 줄만 바꾸면 응답에서 Suspense 관련 산출물이 통째로 사라진다.
 * fallback, 자리 표시자, 화면 밖 도착분, 교체 스크립트가 모두 불필요해지기 때문.
 *
 * 코드는 실측 응답 기준.
 */

type Mode = "shell" | "all";

/** 응답 한 줄. only가 지정되면 그 모드에서만 나타난다. */
type Row = {
  text: string;
  only?: Mode;
  tag?: "fallback" | "slot" | "hidden" | "script" | "marker";
};

const ROWS: Row[] = [
  { text: `<div id="root">` },
  { text: `  <h1>Todo List</h1>` },

  { text: `  <!--$?-->`, only: "shell", tag: "marker" },
  { text: `  <template id="B:0"></template>`, only: "shell", tag: "slot" },
  { text: `  <div>loading...</div>`, only: "shell", tag: "fallback" },
  { text: `  <!--/$-->`, only: "shell", tag: "marker" },

  { text: `  <!--$-->`, only: "all", tag: "marker" },
  { text: `  <ul><li>Buy groceries</li>...</ul>`, only: "all" },
  { text: `  <!--/$-->`, only: "all", tag: "marker" },

  { text: `</div>` },

  { text: `<div hidden id="S:0">`, only: "shell", tag: "hidden" },
  {
    text: `  <ul><li>Buy groceries</li>...</ul>`,
    only: "shell",
    tag: "hidden",
  },
  { text: `</div>`, only: "shell", tag: "hidden" },

  { text: `<script>`, only: "shell", tag: "script" },
  {
    text: `  $RB=[];$RV=function(a){ ...약 700바이트... };`,
    only: "shell",
    tag: "script",
  },
  { text: `  $RC=function(a,b){ ... };`, only: "shell", tag: "script" },
  { text: `  $RC("B:0","S:0")`, only: "shell", tag: "script" },
  { text: `</script>`, only: "shell", tag: "script" },
];

const FACTS: Record<
  Mode,
  {
    ttfb: string;
    firstPaint: string;
    screen: string;
    audience: string;
    js: string;
  }
> = {
  shell: {
    ttfb: "0.006s",
    firstPaint: "0.006s — loading...",
    screen: "즉시 fallback, 2초 뒤 목록",
    audience: "사람",
    js: "교체에 JS 필요",
  },
  all: {
    ttfb: "0.013s *",
    firstPaint: "2.0s — 목록",
    screen: "2초간 흰 화면",
    audience: "크롤러, SSG",
    js: "불필요",
  },
};

export default function ReadyComparison() {
  const [mode, setMode] = useState<Mode>("shell");
  const facts = FACTS[mode];

  const visible = ROWS.filter((r) => !r.only || r.only === mode);
  const removed = ROWS.filter((r) => r.only === "shell").length;

  return (
    <div className="rd">
      <style>{CSS}</style>

      {/* ── 전환 ─────────────────────────────── */}
      <div className="rd-switch" role="group" aria-label="콜백 선택">
        {(["shell", "all"] as Mode[]).map((m) => (
          <button
            key={m}
            className={`rd-tab ${mode === m ? "is-on" : ""}`}
            onClick={() => setMode(m)}
          >
            <code>{m === "shell" ? "onShellReady" : "onAllReady"}</code>
            <span>
              {m === "shell" ? "shell이 준비되면 전송" : "전부 준비되면 전송"}
            </span>
          </button>
        ))}
      </div>

      <div className="rd-body">
        {/* ── 응답 ───────────────────────────── */}
        <div className="rd-col">
          <div className="rd-tag">
            <span>서버가 보낸 응답</span>
            {mode === "all" && <span className="rd-drop">−{removed}줄</span>}
          </div>

          <pre className="rd-code">
            {visible.map((row, i) => (
              <div
                key={`${mode}-${i}`}
                className={`rd-line ${row.tag ? `is-${row.tag}` : ""} ${
                  row.only === "shell" ? "is-suspense" : ""
                }`}
              >
                {row.text}
              </div>
            ))}
          </pre>

          {mode === "shell" && (
            <ul className="rd-legend">
              <li>
                <i className="k k--slot" />
                자리 표시자
              </li>
              <li>
                <i className="k k--fallback" />
                fallback
              </li>
              <li>
                <i className="k k--hidden" />
                화면 밖 도착분
              </li>
              <li>
                <i className="k k--script" />
                교체 스크립트
              </li>
            </ul>
          )}

          {mode === "all" && (
            <p className="rd-note">
              완성된 상태로 보내므로{" "}
              <strong>나중에 채운다는 표시 자체가 불필요</strong>하다. 마커도
              미해결에서 해결로 바뀐다.
            </p>
          )}
        </div>

        {/* ── 사실 ───────────────────────────── */}
        <div className="rd-col">
          <div className="rd-tag">
            <span>측정과 성격</span>
          </div>

          <dl className="rd-facts">
            <div>
              <dt>TTFB</dt>
              <dd>{facts.ttfb}</dd>
            </div>
            <div>
              <dt>첫 화면</dt>
              <dd>{facts.firstPaint}</dd>
            </div>
            <div>
              <dt>사용자 체감</dt>
              <dd>{facts.screen}</dd>
            </div>
            <div>
              <dt>JS 의존</dt>
              <dd>{facts.js}</dd>
            </div>
            <div>
              <dt>적합한 대상</dt>
              <dd className="rd-strong">{facts.audience}</dd>
            </div>
          </dl>

          {mode === "all" && (
            <p className="rd-footnote">
              * TTFB가 짧게 나오는 것은 헤더 전송 시점이 잡히기 때문이다. 본문은
              2초 뒤에 온다. <strong>TTFB만으로는 판정할 수 없다.</strong>
            </p>
          )}

          {mode === "shell" && (
            <p className="rd-footnote">
              사람은 2초간 흰 화면을 견디기 어렵지만 <code>loading...</code>은
              참아준다. 크롤러는 화면을 보지 않으므로 <code>loading...</code>을
              그냥 콘텐츠로 읽는다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */

const CSS = `
.rd {
  font-family: var(--font-sans);
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  padding: 1.25rem;
}

/* 전환 */
.rd-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 1.25rem;
}

.rd-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.rd-tab:hover { border-color: var(--muted); }

.rd-tab.is-on {
  border-color: var(--ink);
  background: var(--surface);
}

.rd-tab code {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--muted);
}

.rd-tab span {
  font-size: 0.75rem;
  color: var(--muted);
}

.rd-tab.is-on code { color: var(--ink); font-weight: 700; }
.rd-tab.is-on span { color: var(--ink); }

/* 본체 */
.rd-body {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 48rem) {
  .rd-body { grid-template-columns: 1fr; }
}

.rd-tag {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.375rem;
}

.rd-drop {
  font-family: var(--font-mono);
  letter-spacing: 0;
  text-transform: none;
  color: var(--arrived);
  font-weight: 700;
}

/* 코드 */
.rd-code {
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

.rd-line {
  white-space: pre;
  padding: 0 4px;
  margin: 0 -4px;
  border-radius: 2px;
  color: var(--ink);
}

.rd-line.is-suspense { color: var(--ink); }

.rd-line.is-marker   { color: var(--pending); }
.rd-line.is-slot     { background: #eef2ff; }
.rd-line.is-fallback { background: #ecfdf5; }
.rd-line.is-hidden   { background: #fef6e7; }
.rd-line.is-script   { background: #f5f0fa; }

/* 범례 */
.rd-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.875rem;
  list-style: none;
  margin: 0.625rem 0 0;
  padding: 0;
  font-size: 0.6875rem;
  color: var(--muted);
}

.rd-legend li {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  margin: 0;
}

.k {
  width: 10px; height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,.08);
}

.k--slot     { background: #eef2ff; }
.k--fallback { background: #ecfdf5; }
.k--hidden   { background: #fef6e7; }
.k--script   { background: #f5f0fa; }

/* 사실 목록 */
.rd-facts {
  margin: 0;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--surface);
  overflow: hidden;
}

.rd-facts > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rule);
}

.rd-facts > div:last-child { border-bottom: 0; }

.rd-facts dt {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

.rd-facts dd {
  margin: 0;
  font-size: 0.8125rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rd-strong { font-weight: 700; color: var(--arrived); }

.rd-note,
.rd-footnote {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  line-height: 1.7;
  color: var(--muted);
}

.rd-note code,
.rd-footnote code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.rd-note strong,
.rd-footnote strong { color: var(--ink); }
`;
