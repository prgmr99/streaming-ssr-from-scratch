# 04. 여러 개의 Suspense boundary — 자리와 내용의 분리

## 이 단계에서 답하려는 질문

boundary가 하나일 때는 "2초 뒤 채워진다"밖에 보이지 않는다.
여러 개가 되어야 드러나는 것:

> 도착 순서를 결정하는 것은 **완료 순서인가, 선언 순서인가?**
> 순서가 뒤섞이면 화면은 어떻게 되는가?

---

# 1부. 근본 문제 — HTML은 되돌릴 수 없다

이 단계를 이해하려면 여기서 출발해야 한다.

HTML은 **위에서 아래로 한 방향으로만** 흘러간다.
서버가 이미 보낸 부분은 고칠 수 없다. 부친 편지를 수정할 수 없는 것과 같다.

그런데 스트리밍이 하려는 일은 이렇다.

```
[6ms]  <div>loading...</div>          ← 일단 이걸 보냄
[3초]  이 자리를 실제 목록으로 바꾸고 싶음   ← 그런데 이미 보냈는데?
```

**보낸 것을 어떻게 바꾸는가.** 이것이 근본 문제다.

## 해법: 나중에 도착한 것을 JS로 옮긴다

HTML로는 불가능하므로 **JavaScript**를 쓴다. DOM은 수정 가능하기 때문이다.

1. 완성된 콘텐츠를 문서 **맨 아래에** 붙여 보낸다 (뒤에 붙이는 것은 가능하므로)
2. 그냥 붙이면 화면 아래에 뜬금없이 나타나므로 `hidden`을 달아 **안 보이게** 한다
3. 작은 스크립트를 보내 숨겨둔 것을 **원래 자리로 옮긴다**

**이것이 React 스트리밍 SSR의 전부다.** 나머지는 이 세 단계를 위한 장치다.

---

# 2부. 실험

## 설계

선언 순서와 완료 순서를 **일부러 어긋나게** 배치했다.

```
<Suspense><Slow />  </Suspense>   ← 3초,   맨 위   → B:0
<Suspense><Fast />  </Suspense>   ← 0.5초, 가운데  → B:1
<Suspense><Medium /></Suspense>   ← 1.5초, 맨 아래 → B:2
```

서버는 `onShellReady` 그대로. 건드리지 않는다.

## 결과 — 시간순 분해

### ① 6ms — shell: 자리를 미리 잡는다

```html
<div id="root">
  <h1>Todo List</h1>
  <!--$?--><template id="B:0"></template>
  <div>loading...</div>
  <!--/$-->
  <!--$?--><template id="B:1"></template>
  <div>loading...</div>
  <!--/$-->
  <!--$?--><template id="B:2"></template>
  <div>loading...</div>
  <!--/$-->
</div>
<script id="_R_">
  requestAnimationFrame(function () {
    $RT = performance.now();
  });
</script>
```

세 요소를 구분해서 볼 것.

| 요소                      | 역할                                                      |
| ------------------------- | --------------------------------------------------------- |
| `<div>loading...</div>`   | fallback. 지금 화면에 보이는 것                           |
| `<template id="B:0">`     | **주소표.** 나중에 "B:0으로 보내라"고 지시할 때 쓸 이름표 |
| `<!--$?--> ... <!--/$-->` | **영역 경계.** 이 구간이 해당 Suspense의 구역             |

`<template>`을 쓴 이유는 이 태그의 내용이 렌더링되지 않기 때문이다. 순수한 표식 역할.

`$?`는 "아직 안 채워짐"을 뜻한다.

**이 시점에 완료된 컴포넌트는 하나도 없다. 그런데 자리는 3개 다 잡혀 있다. 선언 순서대로.**

`<script id="_R_">`는 `$RT`(최초 렌더 시각)를 기록한다.
뒤에서 교체 타이밍 계산에 쓰인다. `id`가 붙은 것은 중복 삽입을 피하기 위한 것으로 보인다.

### ② 0.5초 — Fast 완료

```html
<div hidden id="S:1">
  <ul>
    ...
  </ul>
</div>
<script>
  $RB=[];$RV=function(a){...};$RC=function(a,b){...};$RC("B:1","S:1")
</script>
```

- `S:1` = 실제 콘텐츠. `hidden`이라 안 보인다. **문서 맨 아래에 도착**
- `$RC("B:1","S:1")` = **"S:1을 B:1 자리로 옮겨라"**

브라우저는 `<script>`를 만나면 즉시 실행하므로, 도착하자마자 교체된다.
화면에서는 가운데 `loading...`이 목록으로 바뀐다.

### ③ 1.5초 — Medium / ④ 3초 — Slow

```html
<div hidden id="S:2">...</div>
<script>
  $RC("B:2", "S:2");
</script>
<div hidden id="S:0">...</div>
<script>
  $RC("B:0", "S:0");
</script>
```

**함수 정의가 없다. 호출 한 줄뿐이다.**

---

# 3부. 핵심 질문 두 개

## Q1. 왜 도착 순서가 0 → 1 → 2가 아닌가

**서버는 없는 것을 보낼 수 없기 때문이다.**

Slow는 3초 걸린다. 0.5초 시점에 서버가 Slow의 HTML을 보내고 싶어도 **아직 만들어지지 않았다.**
그 시점에 보낼 수 있는 것은 완료된 Fast뿐이다.

선언 순서를 지키려면 Slow가 끝날 때까지 전부 기다려야 하고, 그러면 스트리밍이 아니다.
그것이 곧 `onAllReady`다.

## Q2. 순서가 뒤섞였는데 화면은 왜 안 뒤섞이나

**주소가 붙어 있기 때문이다.**

`$RC("B:0","S:0")`은 "맨 위 자리에 넣어라"라는 뜻이다.
**id로 찾아가므로 언제 도착하든 무관하다.** 택배가 순서와 상관없이 각자 주소로 배달되는 것과 같다.

### 결론

|                                | 순서                            |
| ------------------------------ | ------------------------------- |
| 자리 (`<template id="B:n">`)   | **선언 순** — 0, 1, 2           |
| 내용 (`<div hidden id="S:n">`) | **완료 순** — 1, 2, 0           |
| 교체 명령 (`$RC`)              | **완료 순** — 1, 2, 0           |
| 최종 화면                      | **선언 순** (주소로 찾아가므로) |

> **자리는 선언 순서로 미리 잡고, 내용은 완료 순서로 채운다.**
> **이 분리가 스트리밍의 핵심 아이디어다.**

---

# 4부. `$RC`란 무엇인가

특별한 문법이 아니라 **React가 만든 평범한 JS 함수 이름**이다.
JS에서 `$`는 식별자에 쓸 수 있는 문자다. 아마 **R**eact **C**omplete의 약자.

## 하는 일 — 그게 전부다

```js
$RC("B:1", "S:1");
```

1. `getElementById("B:1")` — 자리 표시자 찾기
2. `getElementById("S:1")` — 숨겨진 콘텐츠 찾기
3. 그 자리의 `loading...`을 지우고
4. `S:1`의 자식들을 `insertBefore`로 밀어 넣기

**DOM 조작 그 이상도 이하도 아니다.**

직접 짜면 이 정도다:

```js
function move(placeholderId, contentId) {
  const slot = document.getElementById(placeholderId);
  const content = document.getElementById(contentId);
  slot.replaceWith(...content.children);
}
```

React 버전이 긴 것은 중첩 boundary 처리, 에러 상태, 배칭 같은 예외 처리 때문이지
원리가 복잡해서가 아니다.

## 비유

이사 트럭이 짐을 **현관 앞**에 내려놓고 간다 (`S:1`이 문서 끝에 도착).
`$RC`는 **"이 상자는 안방으로"**라고 지시하고 옮기는 사람이다.
상자 안의 물건을 만들지도, 사오지도 않는다. **위치만 바꾼다.**

## 헷갈리기 쉬운 것들과의 구분

|               | 하는 일                         | 실행 위치                  |
| ------------- | ------------------------------- | -------------------------- |
| `getTodoList` | 데이터 가져오기 (2초 대기)      | **서버**                   |
| React 렌더링  | 데이터 → HTML 변환              | **서버**                   |
| **`$RC`**     | **HTML 덩어리를 제자리로 이동** | **브라우저**               |
| 하이드레이션  | 이벤트·상태를 붙여 살아있게 함  | 브라우저 (**아직 미구현**) |

### `$RC`는 하이드레이션이 아니다

혼동하기 쉬운 지점. **현재 프로젝트에는 하이드레이션이 없는데도 `$RC`는 동작한다.**

|           | `$RC`                     | 하이드레이션                 |
| --------- | ------------------------- | ---------------------------- |
| 하는 일   | 자리 표시자 → 콘텐츠 교체 | 정적 HTML에 이벤트·상태 부착 |
| 필요한 것 | 없음 (인라인 스크립트)    | React 번들 다운로드          |
| 시점      | chunk 도착 즉시           | 번들 로드 후                 |
| 현재 상태 | ✅ 동작 중                | ❌ 미구현                    |

**`$RC`는 "HTML을 완성"하고, 하이드레이션은 "HTML을 살아있게" 한다.**

지금 페이지는 `$RC` 덕에 콘텐츠가 다 채워지지만, 버튼을 넣어도 클릭이 동작하지 않는다.

**왜 분리했는가:** React 번들이 느리거나 실패해도 콘텐츠는 보여야 하기 때문이다.
`$RC`가 번들 안에 있었다면 번들 도착까지 `loading...`이 계속 떠 있었을 것이다.

### `$RC`는 `getTodoList`와 무관하다

`getTodoList`는 **서버에서만 실행된다.** 브라우저는 그 함수의 존재조차 모른다.
브라우저가 받는 것은 실행된 **결과 HTML**뿐이다.

콘솔에서 확인 가능:

```js
typeof $RC; // "function"   ← 있음
typeof getTodoList; // "undefined"  ← 없음
```

---

# 5부. 함수 정의는 왜 한 번만 오는가

```html
S:1 뒤 →
<script>
  $RB=[];$RV=function(a){...};$RC=function(a,b){...};$RC("B:1","S:1")
</script>
S:2 뒤 →
<script>
  $RC("B:2", "S:2");
</script>
S:0 뒤 →
<script>
  $RC("B:0", "S:0");
</script>
```

`$RC`는 JS 함수다. 첫 스크립트가 실행되는 순간 전역에 정의된다.
그 뒤로는 호출만 하면 되므로 정의를 다시 보낼 이유가 없다.

React는 "이 응답에서 이미 정의를 보냈는가"를 기억하고 있다가 첫 번째에만 정의를 붙인다.

**이유는 응답 크기다.** `$RC`/`$RV` 정의는 700바이트 정도다.
boundary 20개인 페이지에서 매번 보내면 14KB가 낭비된다.
정의 1회 + 호출 20회면 700바이트 + 400바이트 수준이다.

---

# 6부. 아직 파고들지 않은 것 — `$RB` / `$RV`

`$RC`는 사실 **교체를 직접 하지 않는다.** 등록하고 스케줄링만 한다.

```js
$RC=function(a,b){
  ...
  a.previousSibling.data="$~";        // "교체 대기" 마커로 변경
  $RB.push(a,b);                      // 대기열에 추가
  2===$RB.length && (...스케줄링...)   // 쌍이 모이면 $RV 예약
};
```

**실제 DOM 조작은 `$RV`가 한다.**

## 타이밍 로직

```js
setTimeout($RV.bind(null, $RB), 2300 > a && 2e3 < a ? 2300 - a : $RT + 300 - a);
```

- 2000~2300ms 사이 도착 → 2300ms까지 대기 후 교체
- 그 외 → `$RT + 300` 시점까지 대기

**즉시 교체하지 않고 살짝 지연시킨다.**
`loading...`이 0.1초만 보이고 사라지면 오히려 거슬리므로,
깜빡임을 막으려는 장치로 추정된다.

`$RV`는 `$RB` 배열을 2개씩(`b+=2`) 순회하므로,
여러 boundary가 거의 동시에 도착하면 **묶어서 한 번에 처리**하는 구조로 보인다.

> **모두 코드를 읽고 추론한 것이다.**
> 확정하려면 두 컴포넌트를 같은 지연 시간으로 맞춰 실제로 묶이는지 확인해야 한다. → 미실행

## 마커 종류

`$RV` 코드에서 다루는 주석 마커들:

| 마커 | 의미      |
| ---- | --------- |
| `$`  | 해결됨    |
| `$?` | 대기 중   |
| `$~` | 교체 예정 |
| `$!` | **에러**  |
| `&`  | 미확인    |

`$RV`는 마커를 만날 때마다 depth 카운터(`h`)를 증감시킨다.
**중첩 boundary** 때문이다. `<!--$-->` 안에 또 `<!--$-->`가 있을 수 있으므로
짝을 맞춰 자기 영역의 끝을 찾아야 한다.

`$!`(에러 마커)는 0단계에서 이미 만난 적이 있다.
`renderToString`이 Suspense를 처리하지 못하고 실패했을 때 `<!--$!-->`가 나왔다.

---

# 이 단계에서 배운 것

1. **HTML은 append-only다.** 이미 보낸 부분을 고칠 수 없다는 제약이
   스트리밍 SSR의 모든 설계를 규정한다

2. **우회책은 "끝에 숨겨 보내고 JS로 옮기기"다.**
   `<div hidden id="S:n">` + `$RC("B:n","S:n")`

3. **자리는 선언 순, 내용은 완료 순.** 이 분리가 스트리밍을 가능하게 한다.
   id 주소 체계 덕분에 도착 순서가 뒤섞여도 화면은 올바르다

4. **`$RC`는 DOM을 옮기는 함수일 뿐이다.**
   데이터를 가져오지도, 하이드레이션을 하지도 않는다

5. **`$RC` ≠ 하이드레이션.** 하이드레이션 없이도 콘텐츠는 채워진다.
   번들 실패와 무관하게 콘텐츠를 보여주기 위한 의도적 분리

6. **함수 정의는 응답당 한 번.** 응답 크기 최적화

---

# 남은 확인 사항

- [ ] 브라우저에서 세 영역이 채워지는 순서 육안 확인 (가운데 → 아래 → 위)
- [ ] 두 컴포넌트를 **같은 지연 시간**으로 맞춰 `$RB`/`$RV` 배칭이 실제로 일어나는지 확인
- [ ] **중첩 boundary** 실험 — 부모가 늦고 자식이 빠르면? depth 카운터가 필요한 상황 재현
- [ ] `&` 마커의 정체
- [ ] `$RV`의 지연 로직(`2300`, `+300`)이 실제로 깜빡임 방지 목적인지 소스로 확인 → T3

# 다음 질문 (T1-3: 하이드레이션)

- `bootstrapModules`로 클라이언트 번들을 주입하면 `<script>`가 스트림 어디에 삽입되는가?
- `hydrateRoot(document, ...)` vs `hydrateRoot(#root, ...)` — 2단계 A/B 방식의 실제 차이
- `async function TodoList()`는 클라이언트에서 어떻게 처리해야 하는가?
  → 이 문제가 RSC가 존재하는 이유로 이어진다

---

# 전체 파일

## src/lib.ts

```ts
export type TodoItem = {
  id: number;
  title: string;
};

const TODO_LIST: TodoItem[] = [
  { id: 1, title: "Buy groceries" },
  { id: 2, title: "Read a book" },
  { id: 3, title: "Write a blog post" },
];

/** 지연 시간을 지정할 수 있는 범용 fetcher */
export async function getTodoList(delayMs: number): Promise<TodoItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(TODO_LIST), delayMs);
  });
}
```

## src/client.tsx

```tsx
import { Suspense } from "react";
import { getTodoList } from "./lib";

type TodoListProps = {
  delayMs: number;
};

async function TodoList({ delayMs }: TodoListProps) {
  const todoList = await getTodoList(delayMs);

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

          {/* 선언 순서와 완료 순서를 일부러 어긋나게 배치 */}
          <Suspense fallback={<div>loading...</div>}>
            <TodoList delayMs={3000} />
          </Suspense>

          <Suspense fallback={<div>loading...</div>}>
            <TodoList delayMs={500} />
          </Suspense>

          <Suspense fallback={<div>loading...</div>}>
            <TodoList delayMs={1500} />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
```

## src/server.ts

2단계 B 버전과 동일. 변경 없음.

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
