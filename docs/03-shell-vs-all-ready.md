# 03. `onShellReady` vs `onAllReady` — 스트리밍을 언제 시작할 것인가

## 이 단계에서 답하려는 질문

> `renderToPipeableStream`은 완성 시점을 알려주는 콜백을 **두 종류** 제공한다.
> 스트리밍이 좋은 것이라면 `onShellReady` 하나면 충분할 텐데, 왜 `onAllReady`가 따로 있는가?

---

## 배경: 콜백의 종류

`renderToPipeableStream`의 옵션에 넘길 수 있는 주요 콜백들.

| 콜백           | 호출 시점                                   |
| -------------- | ------------------------------------------- |
| `onShellReady` | Suspense **바깥** 영역(shell)이 완성됐을 때 |
| `onAllReady`   | **모든** Suspense 내부까지 완성됐을 때      |
| `onShellError` | shell을 만들다 실패했을 때                  |
| `onError`      | 렌더링 중 에러가 발생했을 때                |

이 중 `onShellReady` / `onAllReady`가 **"언제 `pipe`를 시작할 것인가"**를 결정한다.
지금까지는 `onShellReady`를 써왔다.

---

## 실험

바꾼 것은 한 줄.

```ts
onAllReady() {
  pipe(passThrough);
},
```

### 예상

- TTFB가 `onShellReady`보다 클 것이다 (2초 근처)
- `loading...`과 `$RC(...)`는 → **남아 있을까, 사라질까?**

---

## 결과

```
<!DOCTYPE html><html lang="ko"><head><meta charSet="utf-8"/><title>Streaming SSR</title></head>
<body><div id="root"><h1>Todo List</h1><!--$--><ul><li>Buy groceries</li><li>Read a book</li><li>Write a blog post</li></ul><!--/$--></div></body></html>

TTFB: 0.013438s / Total: 2.032018s
```

### 응답 원문 비교

**`onShellReady` (기존)**

```html
<!--$?--><template id="B:0"></template>
<div>loading...</div>
<!--/$-->
...
<script id="_R_">
  requestAnimationFrame(...)
</script>
<div hidden id="S:0">
  <ul>
    ...
  </ul>
</div>
<script>
  $RB=[];$RV=function(a){...};$RC=function(a,b){...};$RC("B:0","S:0")
</script>
```

**`onAllReady` (변경 후)**

```html
<!--$-->
<ul>
  <li>Buy groceries</li>
  ...
</ul>
<!--/$-->
```

**전부 사라졌다.**

- `loading...` (fallback)
- `<template id="B:0">` (자리 표시자)
- `<div hidden id="S:0">` (화면 밖 도착분)
- `$RC` / `$RV` / `$RB` 인라인 스크립트 전체

그리고 Suspense 주석 마커도 바뀌었다.

|                | 마커        | 의미                 |
| -------------- | ----------- | -------------------- |
| `onShellReady` | `<!--$?-->` | 미해결 (나중에 채움) |
| `onAllReady`   | `<!--$-->`  | 해결됨               |

처음부터 완성된 상태로 보내므로 "나중에 채운다"는 표시 자체가 불필요하다.

---

## TTFB가 또 속였다

**예상은 2초, 실측은 0.013초.**

`Content-Length`가 없는 chunked 응답이므로, `Response` 객체가 만들어지는 순간
헤더와 스트림 시작 신호가 먼저 나간다.
curl의 `time_starttransfer`는 이것을 첫 전송으로 계산한다.
실제 본문 바이트는 2초 뒤에 오는데도 TTFB는 13ms로 찍힌다.

**브라우저에서는 2초간 흰 화면이 명확하게 체감됐다.**

> 2단계의 버퍼링 실험에 이어 **두 번째로 TTFB가 실패했다.**
> 이 프로젝트에서 반복적으로 확인되는 것:
> **TTFB는 스트리밍 여부를 판정하는 지표로 신뢰할 수 없다.**
>
> 신뢰할 수 있는 것:
>
> - 응답 원문에 fallback / 교체 스크립트가 있는가
> - 브라우저에서 흰 화면이 몇 초인가 (FCP)

---

## 그래서 `onAllReady`는 왜 존재하는가

### 트레이드오프

|              | `onShellReady`          | `onAllReady`      |
| ------------ | ----------------------- | ----------------- |
| 사용자 체감  | 6ms에 `loading...`      | **2초간 흰 화면** |
| 응답 크기    | 큼 (교체 스크립트 포함) | 작음 (순수 HTML)  |
| fallback     | 있음                    | 없음              |
| JS 필요 여부 | 교체에 JS 필요          | **불필요**        |
| 적합한 대상  | 사람                    | 크롤러, SSG       |

### 크롤러

검색엔진 크롤러는 JS를 실행하지 않거나 늦게 실행한다.
`onShellReady` 응답을 받으면 **`loading...`을 콘텐츠로 인식할 수 있다.**
`onAllReady`는 완성된 HTML을 주므로 그런 일이 없다.

### 정적 사이트 생성(SSG)

빌드 타임에 HTML 파일로 저장하는 것이 목적이므로 스트리밍은 의미가 없다.
완성본이 필요하다.

### 한 문장 요약

> **`onShellReady`는 사람을 위한 것, `onAllReady`는 기계를 위한 것.**

사람은 2초간 흰 화면을 견디기 어렵지만 `loading...`은 참아준다.
크롤러는 화면을 보지 않고 HTML만 읽으므로 `loading...`을 그냥 콘텐츠로 받아들인다.

---

## 실무에서는 둘 중 하나를 고르지 않는다

**요청에 따라 갈라 쓴다.** 같은 URL이라도 사람이 오면 스트리밍, 크롤러가 오면 완성본.

```ts
const isBot = /* User-Agent 검사 */;
const callbackName = isBot ? "onAllReady" : "onShellReady";

renderToPipeableStream(element, {
  [callbackName]() {
    pipe(passThrough);
  },
  onError(error) { ... },
});
```

Remix가 실제로 이 패턴을 쓴다 (`isbot` 패키지로 User-Agent 판별).

**미구현 — 직접 해볼 것:**
`ctx.req.header("user-agent")`로 UA를 읽고 분기.
테스트는 `curl -A "Googlebot" localhost:3001`.

---

## 이 단계에서 배운 것

1. **`onShellReady` / `onAllReady`는 우열이 아니라 용도의 차이다**
   스트리밍이 항상 정답은 아니다. 소비자가 사람인지 기계인지에 따라 갈린다

2. **`onAllReady`는 응답에서 Suspense 관련 산출물을 통째로 제거한다**
   fallback, 자리 표시자, 교체 스크립트가 모두 불필요해진다.
   결과적으로 응답 크기가 줄고 JS 없이도 완전한 HTML이 된다

3. **Suspense 주석 마커로 상태를 읽을 수 있다** — `<!--$?-->` 미해결 / `<!--$-->` 해결

4. **TTFB의 두 번째 실패**
   chunked 응답에서는 헤더 전송 시점이 TTFB로 잡혀 본문 지연을 감춘다.
   **눈이 숫자보다 정확했다** — "실제로 보면 엄청 느리다"는 체감이 맞았다

---

## 남은 확인 사항

- [ ] User-Agent 분기 구현 (`curl -A "Googlebot"`으로 검증)
- [ ] `onShellError`와 `onError`의 차이 — 상태 코드를 바꿀 수 있는 시점의 경계
      (T1-5 에러 처리 단계에서 다룰 것)
- [ ] 본문 첫 바이트 도착 시각을 정확히 재는 방법 찾기 (TTFB 대체 지표)

## 다음 질문 (T1-2)

- Suspense boundary를 2개 이상 두면 `$RC`는 몇 번 호출되는가?
- 도착 순서를 결정하는 것은 **완료 순서인가, 선언 순서인가?**
- 중첩 boundary에서 부모가 늦고 자식이 빠르면 어떻게 되는가?
- `$RB` / `$RV`의 배칭 로직이 실제로 관측되는가?

---

# 전체 파일

`server.ts`의 콜백 이름 한 줄만 다르다. `client.tsx`, `lib.ts`는 2단계 B 버전 그대로.

## src/server.ts — `onAllReady` 버전

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./client";

const app = new Hono();

app.get("/", () => {
  const element = createElement(App);

  const passThrough = new PassThrough();
  const reactStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    // 모든 Suspense가 해결된 뒤에야 흘려보낸다.
    // 스트리밍의 이점은 사라지지만, 완성된 HTML을 얻는다. (크롤러 / SSG용)
    onAllReady() {
      pipe(passThrough);
    },
    onError(error) {
      console.error(error);
      passThrough.destroy();
      abort(error);
    },
  });

  return new Response(reactStream, {
    headers: { "Content-Type": "text/html" },
  });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
```

## 참고: User-Agent 분기 (미구현 — 직접 작성할 것)

```ts
app.get("/", (ctx) => {
  const userAgent = ctx.req.header("user-agent") ?? "";
  const isBot = /* 판별 로직 */;
  const callbackName = isBot ? "onAllReady" : "onShellReady";

  // ... renderToPipeableStream에 [callbackName] 으로 전달
});
```

> 실행 후에는 `onShellReady` 버전으로 되돌릴 것. T1-2는 스트리밍이 살아있어야 관찰 가능하다.
