# 02. HTML 껍데기 붙이기 — 문자열 조립(A) vs React 트리(B)

## 이 단계에서 답하려는 질문

> 1단계에서 나온 응답은 `<div>`부터 시작했다.
> `<!DOCTYPE html>`, `<html>`, `<head>` 껍데기를
> **스트리밍을 깨뜨리지 않고** 붙이려면 어떻게 해야 하는가?

두 가지 방식을 모두 구현하고 비교했다.

```
A:  header 문자열  +  [React: <div id="root">...]  +  trailer 문자열
B:  [React: <!DOCTYPE html> ~ </html>]   ← 전부 React가 담당
```

결과적으로 당초 목표(DOCTYPE 처리법)는 **처리할 것이 없다**는 결론에 도달했고,
대신 스트리밍의 본질에 관한 더 중요한 것들을 얻었다.

---

## 배경: DOCTYPE과 quirks mode

### DOCTYPE

문서 맨 앞의 `<!DOCTYPE html>` 한 줄. **HTML 태그가 아니라 문서 선언**이다.
브라우저에게 이 문서를 어떤 규칙으로 해석할지 알려준다.

### quirks mode

DOCTYPE이 없으면 브라우저는 **표준 규칙 대신 quirks mode 규칙**으로 렌더링한다.
브라우저가 문서의 "나이"를 판단하는 게 아니라,
DOCTYPE 유무를 신호로 삼아 **적용할 CSS 계산 규칙을 고르는 것**이다.

`document.compatMode`로 현재 모드를 확인할 수 있다.

| 값           | 모드      | 조건         |
| ------------ | --------- | ------------ |
| `CSS1Compat` | standards | DOCTYPE 있음 |
| `BackCompat` | quirks    | DOCTYPE 없음 |

> 이름이 헷갈리게 지어져 있다. `CSS1Compat`이 **표준 모드**다.

### 실제 영향 — 박스 모델

```css
div {
  width: 100px;
  padding: 10px;
  border: 5px solid;
}
```

| 모드      | 실제 너비                              |
| --------- | -------------------------------------- |
| standards | 130px (`width` + padding + border)     |
| quirks    | 100px (padding·border가 안쪽으로 먹힘) |

같은 CSS인데 결과가 다르다. `line-height` 계산, 인라인 요소 여백 등에서도 차이가 있다.

이 모드가 존재하는 이유는 표준 이전에 만들어진 사이트를 깨뜨리지 않기 위해서다.
따라서 DOCTYPE을 빠뜨리면 **지금 만드는 페이지에 옛날 CSS 규칙이 적용된다.**

---

## 방식 A — 문자열로 앞뒤에 붙이기

### 구조

```
응답 스트림 (직접 만든 ReadableStream)
 ├─ [1] header 문자열 enqueue         ← 즉시
 ├─ [2] React 스트림을 읽어 그대로 통과   ← 오는 대로 즉시
 └─ [3] trailer 문자열 enqueue + close  ← React 스트림 종료 후
```

1단계에서는 React 스트림을 `Response`에 **그대로** 넘겼다.
A에서는 중간에 한 겹을 끼워 넣어 우리가 개입한다.

### 개입한다는 것의 의미

```
[개입 X]  React → passThrough → webStream → Response
                                            (HTTP 레이어가 읽음)

[개입 O]  React → passThrough → reactStream → 우리 → responseStream → Response
                                              read    enqueue
```

- `reader.read()` — 스트림에서 **꺼내는** 것
- `controller.enqueue()` — 스트림에 **넣는** 것

우리가 만든 `ReadableStream`은 "읽는 사람에게 무엇을 줄지"를 정의한다.
`enqueue` 순서가 곧 나가는 순서다.

**개입하지 않으면 `read`도 `enqueue`도 존재하지 않는다.**
`Readable.toWeb()`이 반환한 스트림을 `Response`에 넘기면 읽는 주체는 HTTP 레이어다.

### 실측

```
TTFB: 0.006823s / Total: 2.018314s
```

- `<!DOCTYPE html>` 맨 앞, `</div></body></html>` 맨 뒤 ✅
- TTFB 유지 ✅

---

## 방식 B — React 트리 안에 넣기

### 구현

`App`이 `<html>`부터 반환하도록 바꾸고, `server.ts`는 1단계 형태로 되돌린다.
`header`/`trailer`, `TextEncoder`, `ReadableStream` 래핑을 **전부 삭제**한다.

```tsx
function App() {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <title>Streaming SSR</title>
      </head>
      <body>
        <div id="root">
          <h1>Todo List</h1>
          <Suspense fallback={<div>loading...</div>}>
            <TodoList />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
```

> JSX에서는 `charset`이 아니라 **`charSet`**. `class` → `className`과 같은 이유로
> JSX는 DOM 프로퍼티 이름을 따른다.

### 핵심 발견: React가 DOCTYPE을 자동 주입한다

**루트 컴포넌트가 `<html>`을 반환하면 React가 스트림 맨 앞에 DOCTYPE을 넣어준다.**
React 공식 문서(`renderToPipeableStream`)에 명시되어 있다.

조건은 "`<html>` 태그를 쓸 것"이 아니라 **"루트 컴포넌트가 `<html>`을 반환할 것"**이다.

### 실측

```
<!DOCTYPE html><html lang="ko"><head><meta charSet="utf-8"/><title>Streaming SSR</title></head>
<body><div id="root"><h1>Todo List</h1><!--$?--><template id="B:0"></template><div>loading...</div><!--/$--></div>
<script id="_R_">requestAnimationFrame(function(){$RT=performance.now()});</script>
<div hidden id="S:0"><ul>...</ul></div>
<script>...$RC("B:0","S:0")</script></body></html>

TTFB: 0.006035s / Total: 2.013335s
```

DOCTYPE 자동 주입 ✅ / `</html>`까지 React가 닫음 ✅ / TTFB 유지 ✅

---

## A vs B 비교

|                     | A (문자열)         | B (트리 안)     |
| ------------------- | ------------------ | --------------- |
| TTFB                | 0.0068s            | 0.0060s         |
| 밖에서 붙이는 것    | header + trailer   | **없음**        |
| **스트림 개입**     | **필요**           | **불필요**      |
| DOCTYPE             | 직접 작성          | React 자동 주입 |
| `</html>` 닫는 주체 | trailer 문자열     | React           |
| React가 아는 영역   | `#root` 안쪽만     | `<html>` 전체   |
| `<title>` 변경      | header 문자열 조립 | JSX             |
| 오타 검출           | ❌ 불가            | ✅ 컴파일 타임  |
| server.ts 코드량    | 많음               | 1단계 수준      |

### B를 택하는 이유

**1. 오타에 대한 방어**

A의 `header`에 `<meta charst="utf-8">`이라고 써도 TypeScript는 아무 말이 없다.
그냥 문자열이기 때문이다. 런타임 에러도 안 나고 브라우저가 조용히 무시한다.
한글이 깨진 것을 보고서야 알게 된다.

B에서는 `charSt`라고 쓰면 컴파일 단계에서 잡힌다.
**문자열은 검증받지 못하는 데이터지만, JSX는 타입이 붙은 구조다.**

**2. 짝이 갈라지지 않는다**

A는 `<div id="root">`를 `header`에서 열고 `trailer`에서 닫는다.
두 상수가 서로 다른 곳에 떨어져 있어서, 한쪽만 고쳐도 아무도 알려주지 않는다.
B에는 이런 문제가 구조적으로 존재할 수 없다.

**3. 직관성과 관리 비용**

문자열 조립보다 JSX가 읽기 쉽고, 페이지별로 `<title>`을 바꾸는 것도 그냥 props다.
React 19는 메타 태그를 컴포넌트에서 관리하는 방향을 더 강화하고 있다.

### A가 쓰이는 자리

A는 "선택"이라기보다 **"제약"**인 경우가 많다.

- 이미 서버 템플릿(Django, Rails 등)이 HTML을 관리하고 있고 그 일부에만 React를 넣는 경우
- 껍데기가 완전히 고정이고 React 영역만 갈아끼우는 구조

처음부터 만드는 상황이라면 B가 맞다.

---

# 실험: 스트리밍을 일부러 죽여보기

이 단계에서 가장 많은 것을 얻은 부분이다.

## 방법

A 방식 코드에서 루프 안의 `enqueue`를 `push`로 바꿔 **모았다가 한 번에 내보냈다.**

```ts
const chunks: Uint8Array[] = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value); // ← enqueue 대신 모으기
}
for (const chunk of chunks) {
  // ← 루프 끝난 뒤 한 번에
  controller.enqueue(chunk);
}
```

## 예상과 결과

**예상:** TTFB가 2초로 튈 것이다. 출력 내용은 동일할 것이다.

**결과:**

```
TTFB: 0.002676s / Total: 2.007220s
```

**TTFB가 튀지 않았다.**

## 왜 TTFB가 정상으로 보였는가

`[1]`에서 `header`를 먼저 `enqueue`하기 때문이다.
첫 바이트는 header가 즉시 내보냈고, **TTFB는 첫 바이트가 언제 나갔는지만 측정한다.**

React 콘텐츠는 실제로 2초 뒤에 한꺼번에 나갔다.
스트리밍은 죽었는데 TTFB 지표가 그것을 잡지 못했다.

> 실무에서 정확히 이런 일이 벌어진다.
> 껍데기만 빨리 나가고 실제 콘텐츠는 다 모였다가 나가는데,
> TTFB만 보면 "정상"으로 보인다.

## 그러면 무엇이 잡았는가 — 브라우저 화면

브라우저에서 확인하자 두 가지가 즉시 드러났다.

**1. `loading...`이 보이지 않는다**

브라우저는 HTML을 **받는 즉시 파싱하고 그린다.** 다 받을 때까지 기다리지 않는다.

- 정상: 6ms에 `loading...`이 포함된 shell 도착 → 즉시 그림 → 2초간 표시 →
  `S:0` + `$RC` 도착 시 교체
- 버퍼링: 모든 것이 2초 뒤 한꺼번에 도착 → `loading...`을 그리자마자 곧바로 교체 →
  **사람 눈에 안 보일 만큼 스쳐감**

**2. 2초간 흰 화면**

가장 직관적인 차이. 성능 지표로는 **FCP(First Contentful Paint)**가 달라진 것이다.

|               | 흰 화면  | `loading...` | 콘텐츠 |
| ------------- | -------- | ------------ | ------ |
| 정상 스트리밍 | ~6ms     | 6ms ~ 2초    | 2초~   |
| 버퍼링됨      | **~2초** | 스쳐감       | 2초~   |

흰 화면 2초는 사용자에게 "이 사이트 안 되나?"다. `loading...`은 "로딩 중이구나"다.
서버가 일하는 시간은 똑같은데.

## 관찰 수단 비교 — 이 실험의 결론

| 관찰 수단              | 스트리밍 죽은 걸 잡았나        |
| ---------------------- | ------------------------------ |
| curl 출력 내용         | ❌ 완전히 동일                 |
| TTFB                   | ❌ header 때문에 정상으로 보임 |
| `loading...` 표시 여부 | ✅                             |
| **흰 화면 시간 (FCP)** | ✅ **가장 직관적**             |

> **스트리밍이 죽어도 서버가 보내는 바이트는 동일하다.**
> **TTFB도 상황에 따라 정상으로 보인다.**
> **차이는 오직 사용자 화면에서만 드러난다 — 2초간 흰 화면인가, `loading...`인가.**

당초 이 실험의 예상 결론은 "출력은 같은데 숫자가 다르다"였다.
실제로는 **"출력도 같고 숫자도 같은데 사용자 경험만 다르다"**가 나왔다.

이것이 스트리밍 SSR의 본질이기도 하다.
서버가 보내는 바이트는 결국 같다. 다른 것은 **언제 보내느냐**뿐이고,
그 차이는 사용자 화면에서만 드러난다.

## 실험 중 발견한 실수

응답이 이렇게 나왔다:

```html
<!DOCTYPE html><html><head>...<div id="root">     ← A의 header
  <!DOCTYPE html><html lang="ko">...</html>        ← B의 App (통째로)
</div></body></html>                               ← A의 trailer
```

**A 방식 `server.ts` + B 방식 `client.tsx`를 섞어 쓰고 있었다.**
A의 header/trailer가 살아있는데 `App`도 `<html>`부터 반환하니 문서가 두 겹이 됐다.

A/B를 오갈 때는 `server.ts`와 `client.tsx`를 **짝으로** 맞춰야 한다.

---

## 연결: Next.js Pages Router의 `getServerSideProps`

버퍼링된 버전의 사용자 경험은 `getServerSideProps`와 동일하다.

`getServerSideProps`의 동작:
데이터 fetch 완료까지 대기 → `renderToString`으로 HTML 완성 → 한 번에 응답.
그동안 브라우저에 보낼 것이 없으니 흰 화면이 된다.

**같은 증상, 다른 원인:**

|                      | 원인                                                                |
| -------------------- | ------------------------------------------------------------------- |
| `getServerSideProps` | 설계가 그렇다. Pages Router는 스트리밍이 없고 `renderToString` 기반 |
| 버퍼링 실험          | 스트리밍 능력이 있는데 배열에 모아서 죽인 것                        |

**"완성된 HTML을 한 번에 보낸다"는 결과가 같으면 사용자 경험도 같다.**

### App Router가 나온 이유

Pages Router의 한계 — 페이지 안에 느린 데이터가 하나만 있어도 페이지 전체가 그것을 기다린다 —
를 풀기 위해 App Router는 스트리밍 SSR 위에 지어졌다.

`loading.tsx`가 곧 Suspense fallback이고, `<Suspense>`로 감싼 부분만 나중에 도착한다.

**즉 이 프로젝트에서 손으로 만들고 있는 것이 App Router의 밑바닥이다.**

---

## 오해 방지

### A는 서버 컴포넌트(RSC)와 무관하다

A/B는 **HTML 껍데기를 어디서 붙이느냐**의 배관 문제다.

- **지금 하는 것**: SSR. 서버에서 HTML 문자열을 만들어 보냄. `renderToPipeableStream`
- **RSC**: 컴포넌트를 서버에서만 실행하고 결과를 특수 포맷으로 **직렬화**해 전송.
  `react-server-dom-*` 패키지 + 번들러 통합 필요. 완전히 다른 층위

`TodoList`가 `async function`이라 RSC처럼 보이는 것이 혼동의 원인이다.
이는 React 18의 "서버에서 async 컴포넌트를 await할 수 있다"는 기능일 뿐이다.

### A도 하이드레이션이 정상 동작한다

`hydrateRoot(document.getElementById("root"), <App />)`로 컨테이너를 지정하면 된다.
A가 "깨진다"는 것은 사실이 아니다. 부분 하이드레이션은 정상적인 사용법이다.

---

## 기록: 틀렸던 가설

작업 도중 이렇게 판단했다:

> "React는 DOCTYPE을 렌더링할 수 없다. DOCTYPE은 태그가 아니라 문서 선언이라
> React 엘리먼트로 표현할 수 없기 때문이다.
> 따라서 B에서도 DOCTYPE은 직접 주입해야 하고, `ReadableStream` 래핑이 필요하다."

**전제(DOCTYPE은 태그가 아니다)는 맞지만 결론이 틀렸다.**
"엘리먼트로 표현할 수 없다 → 따라서 React가 못 넣는다"로 넘겨짚었다.
React는 엘리먼트 트리와 별개로 Fizz 레벨에서 DOCTYPE을 주입한다.

**발견 경위**

1. DOCTYPE 없이 돌리기로 한 버전의 출력에 DOCTYPE이 이미 찍혀 있었다
2. DOCTYPE을 직접 주입하는 버전을 돌리자 이렇게 나왔다:

```html
<!DOCTYPE html><!DOCTYPE html>
<html lang="ko">
  ...
</html>
```

앞의 것은 React가, 뒤의 것은 내가 넣은 것.

**교훈:** 그럴듯한 논리보다 실행 결과가 먼저다.
가설을 세운 즉시 검증 방법을 정해두면 오류가 오래 가지 않는다.

> 참고: 2022년에는 스트림 앞에 DOCTYPE을 붙일 방법이 없다는 이슈가 실제로
> 존재했다(facebook/react#24789). 이후 개선된 것으로 보인다.
> **정확히 어느 버전부터인지는 확인 필요.**

---

## 이 단계에서 실제로 배운 것

당초 목표는 "DOCTYPE 처리법"이었으나 처리할 것이 없다는 결론에 도달했다.
대신 남은 것:

1. **스트림 개입 패턴** (`read` → `enqueue`)
   A에서 익힌 것. B에서는 불필요했지만 실무에서의 용도는 따로 있다:
   - CSP nonce 주입
   - 초기 데이터 직렬화 (`window.__INITIAL_DATA__`)
   - chunk 단위 로깅·계측

2. **스트리밍이 죽는 방식과, 그것을 관찰하는 법**
   모았다가 내보내면 스트리밍은 죽는다.
   그런데 출력도 TTFB도 정상으로 보일 수 있다.
   **숫자 하나만 봐서는 안 된다.**

3. **스트리밍의 값어치는 FCP에 있다**
   총 로딩 시간이 아니라 첫 픽셀이 언제 뜨느냐.
   2초간 흰 화면인가, `loading...`인가.

4. **quirks mode의 실체** — 브라우저가 CSS 계산 규칙을 고르는 신호가 DOCTYPE이다

5. **문자열 vs 타입 있는 구조의 차이** — A/B 선택의 실질적 근거

6. **틀린 가설이 실행 한 번에 무너지는 경험**

---

## 남은 확인 사항

- [ ] `document.compatMode` 직접 찍어보기 (`CSS1Compat` 기대)
- [ ] header까지 모아서 `enqueue`하면 TTFB가 2초로 튀는지 확인
      (이번 실험에서는 header가 먼저 나가 TTFB가 정상으로 보였다)
- [ ] Network 탭 타임라인 스크린샷 — 정상 버전 / 버퍼링 버전 각 1장
- [ ] `<script id="_R_">`의 `id`가 왜 붙는지 — B에서만 관측됨. 하이드레이션 단계에서 재확인
- [ ] React 어느 버전부터 DOCTYPE 자동 주입이 되는지

## 다음 질문

- `onShellReady` → `onAllReady`로 바꾸면 TTFB는? 왜 콜백이 두 개인가?
- Suspense boundary를 2개 이상 두면 `$RC`는 몇 번, 어떤 순서로 오는가?
- `bootstrapScripts`를 넘기면 `<script>`가 스트림 어디에 삽입되는가?

---

# 전체 파일 (방식 B — 최종)

## src/lib.ts

```ts
export type TodoItem = {
  id: number;
  title: string;
};

export async function getTodoList(): Promise<TodoItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, title: "Buy groceries" },
        { id: 2, title: "Read a book" },
        { id: 3, title: "Write a blog post" },
      ]);
    }, 2000);
  });
}
```

## src/client.tsx

```tsx
import { Suspense } from "react";
import { getTodoList } from "./lib";

async function TodoList() {
  const todoList = await getTodoList();

  return (
    <ul>
      {todoList.map((todoItem) => (
        <li key={todoItem.id}>{todoItem.title}</li>
      ))}
    </ul>
  );
}

function App() {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <title>Streaming SSR</title>
      </head>
      <body>
        <div id="root">
          <h1>Todo List</h1>
          <Suspense fallback={<div>loading...</div>}>
            <TodoList />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
```

## src/server.ts

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./client";

const app = new Hono();

/**
 * 방식 B
 *
 * <html>부터 React 트리 안에 있으므로 서버가 문자열로 붙일 것이 없다.
 * DOCTYPE은 루트가 <html>일 때 React가 자동 주입한다.
 * 따라서 ReadableStream 래핑 없이 스트림을 그대로 넘긴다.
 */
app.get("/", () => {
  const element = createElement(App);

  // React가 쓸 Node stream ─(중계)─> Web stream
  const passThrough = new PassThrough();
  const reactStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    // shell(Suspense 바깥)이 완성된 즉시 흘려보내기 시작
    onShellReady() {
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

## 참고: 버퍼링 실험용 코드 (A 방식 기반)

스트리밍을 일부러 죽여보는 실험. 확인 후 위 B 버전으로 되돌릴 것.

```ts
const responseStream = new ReadableStream({
  async start(controller) {
    controller.enqueue(textEncoder.encode(header));

    const reader = reactStream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); // 모으기 (스트리밍 죽음)
      }
      for (const chunk of chunks) {
        controller.enqueue(chunk); // 한 번에 내보내기
      }
    } catch (error) {
      controller.error(error);
    } finally {
      controller.enqueue(textEncoder.encode(trailer));
      controller.close();
    }
  },
});
```

> 이 실험은 `App`이 `<div>`부터 반환하는 **A 방식 `client.tsx`와 짝**이어야 한다.
> B 방식 `client.tsx`와 섞으면 문서가 두 겹으로 중첩된다.
