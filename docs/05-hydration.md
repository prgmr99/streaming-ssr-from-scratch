# 05. 하이드레이션 — 죽은 HTML을 살리기, 그리고 async의 벽

## 이 단계에서 답하려는 질문

0단계부터 T1-2까지 만든 것은 전부 **죽은 HTML**이었다.
버튼을 넣어도 클릭이 동작하지 않고, `useState`도 살아있지 않았다.

> 서버가 만든 정적 DOM에 React를 다시 붙여 살아있게 만들려면?
> 그리고 `async` 컴포넌트는 클라이언트에서 어떻게 되는가?

|         | 목표                               | 결과             |
| ------- | ---------------------------------- | ---------------- |
| **3-A** | 하이드레이션 동작 확인             | ✅ 버튼이 눌린다 |
| **3-B** | `async` 컴포넌트를 되돌려 부딪히기 | 🔥 벽에 부딪혔다 |

---

# 3-A. 하이드레이션 최소 동작

## 구조 변경

지금까지 `client.tsx`를 **서버만** 사용했다.
하이드레이션부터는 같은 컴포넌트를 **서버와 브라우저가 둘 다** 실행해야 한다.

```
src/
├── app.tsx           ← 공유 컴포넌트 (기존 client.tsx 대체)
├── entry-client.tsx  ← 브라우저 진입점, hydrateRoot 호출
├── server.ts         ← bootstrapModules 옵션 추가
└── lib.ts
```

`client.tsx`라는 이름은 양쪽에서 쓰는 파일이므로 오해를 부른다. `app.tsx`로 변경.

## 새로 필요한 것 — 번들러

브라우저에서 React가 돌아야 하므로 클라이언트 번들이 필요하다.
**여기서 처음으로 번들러가 등장한다.** esbuild를 사용했다.

```json
{
  "scripts": {
    "build:client": "esbuild src/entry-client.tsx --bundle --outfile=public/client.js --format=esm --jsx=automatic",
    "watch:client": "npm run build:client -- --watch",
    "dev": "tsx watch src/server.ts"
  }
}
```

| 옵션              | 이유                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `--bundle`        | React 등 node_modules를 한 파일로 묶음. 브라우저는 `import "react"`를 해석할 수 없다 |
| `--format=esm`    | `bootstrapModules`가 `<script type="module">`을 만들므로 ESM이어야 함                |
| `--jsx=automatic` | React 17+ 방식. `import React` 없이 JSX 변환                                         |

## 핵심 개념 세 가지

### 1. `createRoot`가 아니라 `hydrateRoot`

|               | 동작                                           |
| ------------- | ---------------------------------------------- |
| `createRoot`  | 빈 DOM에 처음부터 그린다                       |
| `hydrateRoot` | **이미 있는 DOM을 재사용**하고 이벤트만 붙인다 |

서버가 이미 HTML을 만들어 보냈으므로 다시 그리면 낭비다.
React는 기존 DOM을 훑으며 "내가 그릴 트리와 같은가"를 확인하고, 같으면 이벤트만 연결한다.

### 2. `hydrateRoot(document, <App />)`

첫 인자가 `document`인 이유는 `App`이 `<html>`부터 반환하기 때문이다(2단계 방식 B).

**방식 A였다면** `hydrateRoot(document.getElementById("root"), <App />)`가 된다.

→ 2단계에서 미뤄뒀던 A/B의 실제 차이가 여기서 드러난다.

### 3. `bootstrapModules`

```ts
renderToPipeableStream(element, {
  bootstrapModules: ["/client.js"],
  ...
})
```

React가 이 경로를 `<script type="module">`로 만들어 **스트림에 직접 끼워 넣는다.**
우리가 `<script>` 태그를 손으로 쓸 필요가 없다.

---

## 실측: `<script>`는 어디에 삽입되는가

**예상: `</body>` 직전**
**실제: shell이 끝나는 지점 — 문서 맨 끝이 아니다**

```html
<head>
  ...
  <link rel="modulepreload" fetchpriority="low" href="/client.js" />
  ← ①
  <title>Streaming SSR</title>
</head>
<body>
  <div id="root">...shell...</div>
  <script>
    requestAnimationFrame(function () {
      $RT = performance.now();
    });
  </script>
  <script type="module" src="/client.js" id="_R_" async=""></script>
  ← ②
  <div hidden id="S:0">...</div>
  ← 2초 뒤 도착
  <script>
    ...$RC("B:0","S:0")
  </script>
</body>
```

### ① `<head>`의 preload 힌트

React가 `<head>`에 `modulepreload`를 미리 넣는다.
실제 `<script>`는 뒤에 있지만 **브라우저는 6ms 시점에 이미 번들을 받기 시작한다.**

**다운로드는 일찍, 실행은 shell 이후.** 이 둘을 분리한 최적화다.

### ② 스크립트 본체는 shell 끝

나중에 도착하는 `S:0`보다 **앞**에 있다.

**이유:** shell만 준비되면 하이드레이션을 시작할 수 있고, 시작해야 한다.
Suspense 내부가 2초 뒤에 오는데 그것을 기다렸다 하이드레이션하면
**Counter 버튼도 2초간 죽어 있게 된다.**

> 예상했던 "`</body>` 직전"은 방향은 맞았지만 정확히는 **"shell 끝"**이다.
> 스트리밍에서는 이 둘이 다르다.
>
> 또한 `type="module"` 스크립트는 기본적으로 defer 동작이라 파싱을 막지 않는다.
> 따라서 "위치 때문에 CRP를 막는다"는 설명은 이 경우 정확하지 않다.
> 진짜 이유는 **하이드레이션이 대상 DOM을 필요로 한다**는 것이다.

---

## 결과

**`+1` 버튼을 누르면 숫자가 올라간다.**

지금까지 만든 것 중 처음으로 살아있는 페이지다.

### 검증 실험 — `client.js` 차단

개발자도구 Network → `client.js` → Block request URL → 새로고침.

**HTML은 멀쩡한데 버튼만 죽는다.**
SSR이 만든 것과 하이드레이션이 하는 일이 정확히 갈리는 지점이다.

---

## 부수 발견: 브라우저 확장이 hydration mismatch를 일으킨다

```
A tree hydrated but some attributes of the server rendered HTML didn't match
the client properties.
  <html lang="ko"
-   data-locator-client-url="chrome-extension://npbfdll.../client.bundle.js"
-   data-locator-target="vscode"
  >
```

`chrome-extension://` — **브라우저 확장이 `<html>`에 속성을 추가한 것.**
시크릿 창에서 열면 사라진다. 코드 문제가 아니다.

### 왜 `<html>`에서 유독 발생하는가

**2단계에서 방식 B를 택했기 때문이다.**
`<html>`이 React 트리 안에 있으므로 React가 그 속성까지 검사한다.

방식 A였다면 `<html>`은 문자열로 붙인 것이라 React가 관심을 갖지 않았을 것이다.

> **2단계에서 "A/B 차이가 하이드레이션에서 드러난다"고 했던 것이 이것이다.**
> 다만 당시 예상했던 방향(A가 깨진다)과는 **반대**다. 이 경우엔 B가 더 예민하다.
>
> 실제 트레이드오프: B가 `<title>` 관리 등에서 낫지만,
> **React가 관리하는 영역이 넓어지는 만큼 외부 간섭에 노출되는 면적도 넓어진다.**

Next.js App Router도 같은 구조라 `<html>`/`<body>`에 `suppressHydrationWarning`을
붙이는 것이 흔한 대응이다.

---

# 3-B. `async` 컴포넌트의 벽

`app.tsx`에 `TodoList`(async) + `Suspense`를 다시 넣었다. Counter는 유지. 서버는 변경 없음.

## 진단 과정 — 세 번 틀렸다

이 단계는 결론보다 **과정이 더 배울 만하다.**

### 오진 1: "fallback 없이도 되겠지"

처음에 `<Suspense>`를 fallback 없이 썼더니 화면에 아무것도 안 나왔다.
"하이드레이션이 깨져서 클라이언트가 서버 HTML을 지운 것"이라고 진단했으나 **틀렸다.**

증거는 curl 응답에 이미 있었다:

```html
<!--$?--><template id="B:0"></template
><!--/$-->
```

boundary 안이 **비어 있다.** 정상이라면 `<div>loading...</div>`가 있어야 한다.
fallback을 주지 않았으니 보여줄 것이 없었을 뿐, 하이드레이션과 무관한 문제였다.

### 오진 2: "그럼 그냥 잘 동작하는구나"

fallback을 넣으니 목록이 정상 표시되고, Counter도 눌리고, 에러도 없었다.
"async 컴포넌트여도 문제없다"고 결론 내렸으나 **틀렸다.**

### 오진 3: "서버에서만 실행되는구나"

`getTodoList`에 로그를 넣어 확인했더니 터미널에만 찍히는 것처럼 보였다.
그러나 다시 확인하니 **브라우저 콘솔에 2초마다 반복해서 찍히고 있었다.**

### 진짜 원인을 가린 것 — 오래된 번들

`lib.ts` 안쪽에 넣은 로그(`"getTodoList 진입"`)는 브라우저에 찍히지 않았다.
그런데 `await` 다음 줄의 로그는 찍혔다. **앞뒤가 맞지 않는 상황.**

```bash
grep -c "getTodoList 진입" public/client.js
# → 0
```

**esbuild watch가 리빌드를 놓쳐 번들이 오래된 상태였다.**
수동으로 `npm run build:client`를 실행하자 비로소 에러가 드러났다.

> **교훈: 관측이 이상하면 번들부터 의심할 것.**
> `grep`으로 번들 내용을 확인하는 것이 가장 빠르다.
> 빌드가 1초도 안 걸리는 규모라면 watch보다 수동 빌드가 안전할 수 있다.

---

## 진짜 결과

### 에러 메시지

```
<TodoList> is an async Client Component.
Only Server Components can be async at the moment.
This error is often caused by accidentally adding 'use client' to a module
that was originally written for the server.
```

### 관측된 증상

|                   | 상태                                    |
| ----------------- | --------------------------------------- |
| 서버 렌더링       | ✅ 정상 (`S:0`에 목록 포함, `$RC` 정상) |
| 화면 표시         | ✅ 정상으로 **보임**                    |
| Counter 버튼      | ✅ 동작                                 |
| **브라우저 콘솔** | 🔥 2초마다 `TodoList` 재실행 무한 반복  |

브라우저 콘솔 로그 (정확히 2초 간격):

```
08:14:24.886  getTodoList 실행: 브라우저   client.js:21747
08:14:26.892  getTodoList 실행: 브라우저   client.js:21747
08:14:28.893  getTodoList 실행: 브라우저   client.js:21747
...
```

### 무한 루프의 구조

```
TodoList() 호출
  → getTodoList()가 새 프로미스 생성
  → React suspend
  → 2초 뒤 프로미스 해결
  → React 재시도 → TodoList() 다시 호출
  → getTodoList()가 또 새 프로미스 생성    ← 여기가 문제
  → ...무한
```

**프로미스가 캐시되지 않는 것이 핵심이다.**
같은 프로미스를 재사용했다면 두 번째 호출에서 즉시 해결됐을 것이다.
재시도 간격이 정확히 2초(= `getTodoList`의 지연 시간)인 것이 결정적 단서였다.

### 화면이 멀쩡해 보였던 이유

`$RC`가 이미 목록을 그려놓았고, 매번 같은 데이터가 돌아오므로 화면이 변하지 않는다.

**에러가 눈에 띄지 않는 것이 최악이다.**
실제 API였다면 2초마다 네트워크 요청이 영원히 나갔을 것이다.

---

## 에러 메시지가 말하는 것

> **"Only Server Components can be async at the moment."**

React가 직접 말하고 있다. async 컴포넌트는 **서버 컴포넌트만** 가능하다.

지금 `TodoList`는 서버와 클라이언트가 **같은 파일을 공유**한다.
React 입장에서 이것은 클라이언트 컴포넌트이고, 클라이언트 컴포넌트는 async일 수 없다.

### SSR과 RSC의 경계가 여기서 드러난다

|                        | 컴포넌트 실행 위치                                 |
| ---------------------- | -------------------------------------------------- |
| **SSR (지금 하는 것)** | 같은 컴포넌트를 서버와 클라이언트가 **둘 다** 실행 |
| **RSC**                | 서버에서만 실행되는 컴포넌트가 **따로 존재**       |

2단계에서 "A 방식은 서버 컴포넌트인가?"라는 질문이 나왔을 때
"완전히 다른 층위"라고 정리했는데, 그 차이가 지금 에러로 나타났다.

---

# 이 단계에서 배운 것

1. **하이드레이션 = 정적 DOM에 이벤트·상태를 붙이는 것**
   `client.js`를 차단하면 HTML은 멀쩡하고 버튼만 죽는다. 역할 분리가 눈에 보인다

2. **bootstrap 스크립트는 shell 끝에 삽입된다**
   문서 끝이 아니다. shell만 있으면 하이드레이션을 시작할 수 있고,
   Suspense 내부를 기다리면 shell의 상호작용까지 늦어지기 때문

3. **다운로드와 실행은 분리된다**
   `<head>`의 `modulepreload`로 일찍 받고, 실행은 shell 이후

4. **방식 B는 외부 간섭에 더 넓게 노출된다**
   `<html>`이 React 관리 영역이므로 브라우저 확장의 속성 추가까지 mismatch로 잡힌다

5. **클라이언트 React는 async 컴포넌트를 지원하지 않는다**
   그런데 **에러가 나면서도 화면은 정상으로 보인다.** 조용히 망가지는 형태

6. **오래된 번들이 문제를 감춘다**
   watch가 리빌드를 놓치면 관측 자체가 신뢰할 수 없게 된다

7. **"깨진다"보다 "안 깨지면서 망가진다"가 더 고약하다**
   당초 예상은 명확한 실패였으나, 실제로는 화면이 멀쩡한 채 무한 재요청이었다

---

# 남은 확인 사항

- [ ] 시크릿 창에서 확장 프로그램 경고 없이 재확인
- [ ] `client.js` 차단 실험 스크린샷 (정리본용)
- [ ] 번들 로드 전 버튼을 빠르게 클릭하면? → 무반응 확인 (hydration 지연 문제의 실체)
- [ ] Suspense 내부에 `useState` 자식을 넣으면 하이드레이션이 되는가?
      (`$RC`로 채워진 영역이 살아있는지 확인)

# 다음 질문 (T1-4)

`async` 컴포넌트를 클라이언트에서 어떻게 처리할 것인가. 선택지:

| 방법                  | 개요                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| 1. 데이터 직렬화      | 서버가 `<script>window.__DATA__=...</script>`로 데이터를 실어 보내고 클라이언트가 읽음 |
| 2. `use(promise)`     | 프로미스를 컴포넌트에 넘기고 `use`로 읽음. 프로미스 캐싱이 관건                        |
| 3. 클라이언트 재fetch | 하이드레이션 후 다시 요청. SSR의 의미가 반감                                           |

**이 선택지들을 저울질하는 것이 RSC가 존재하는 이유를 이해하는 가장 빠른 길이다.**

---

# 전체 파일

## package.json (scripts)

```json
{
  "type": "module",
  "scripts": {
    "build:client": "esbuild src/entry-client.tsx --bundle --outfile=public/client.js --format=esm --jsx=automatic",
    "watch:client": "npm run build:client -- --watch",
    "dev": "tsx watch src/server.ts"
  }
}
```

`.gitignore`에 `public/` 추가.

## src/lib.ts

```ts
export type TodoItem = {
  id: string;
  title: string;
};

export async function getTodoList(
  milliseconds: number = 2000,
): Promise<TodoItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: "1", title: "Buy groceries" },
        { id: "2", title: "Read a book" },
        { id: "3", title: "Write a blog post" },
      ]);
    }, milliseconds);
  });
}
```

## src/app.tsx — 3-A (하이드레이션 확인용)

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>count: {count}</p>
      <button onClick={() => setCount((prev) => prev + 1)}>+1</button>
    </div>
  );
}

/**
 * 서버와 클라이언트가 공유하는 컴포넌트.
 * 서버:       renderToPipeableStream(<App />)
 * 클라이언트: hydrateRoot(document, <App />)
 */
function App() {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <title>Streaming SSR</title>
      </head>
      <body>
        <div id="root">
          <h1>Hydration Test</h1>
          <Counter />
        </div>
      </body>
    </html>
  );
}

export default App;
```

## src/app.tsx — 3-B (async 컴포넌트 복귀 — 벽에 부딪히는 버전)

```tsx
import { Suspense, useState } from "react";
import { getTodoList } from "./lib";

/**
 * 서버에서는 동작하지만 클라이언트에서는 동작하지 않는다.
 *   "<TodoList> is an async Client Component.
 *    Only Server Components can be async at the moment."
 *
 * 게다가 에러만 나는 것이 아니라, 프로미스가 캐시되지 않아
 * 2초마다 무한 재실행된다. (화면은 정상으로 보인다)
 */
async function TodoList({ milliseconds }: { milliseconds: number }) {
  const todoList = await getTodoList(milliseconds);

  return (
    <ul>
      {todoList.map((todoItem) => (
        <li key={todoItem.id}>{todoItem.title}</li>
      ))}
    </ul>
  );
}

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>count: {count}</p>
      <button onClick={() => setCount((prev) => prev + 1)}>+1</button>
    </div>
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
          <h1>Hydration Test</h1>
          <Counter />

          {/* fallback을 빠뜨리면 boundary가 비어 아무것도 표시되지 않는다 */}
          <Suspense fallback={<div>loading...</div>}>
            <TodoList milliseconds={2000} />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
```

## src/entry-client.tsx

```tsx
import { hydrateRoot } from "react-dom/client";
import App from "./app";

/**
 * createRoot가 아니라 hydrateRoot를 쓴다.
 * - createRoot:  빈 DOM에 처음부터 그린다
 * - hydrateRoot: 이미 있는 DOM을 재사용하고 이벤트만 붙인다
 *
 * 첫 인자가 document인 이유:
 * App이 <html>부터 반환하므로(2단계 방식 B) 컨테이너도 문서 전체여야 한다.
 * 방식 A였다면 document.getElementById("root")를 넘겼을 것이다.
 */
hydrateRoot(document, <App />);
```

## src/server.ts

```ts
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./app";

const app = new Hono();

/** esbuild가 만든 public/client.js를 /client.js 경로로 서빙 */
app.use("/client.js", serveStatic({ root: "./public" }));

app.get("/", () => {
  const element = createElement(App);

  const passThrough = new PassThrough();
  const reactStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    /**
     * React가 이 경로를 <script type="module">로 만들어 스트림에 끼워 넣는다.
     * 삽입 위치는 shell 끝 (문서 끝이 아니다).
     * <head>에는 modulepreload 힌트가 따로 들어간다.
     */
    bootstrapModules: ["/client.js"],

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
