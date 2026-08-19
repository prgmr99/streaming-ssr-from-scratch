import { Suspense, useState } from "react";
import { getTodoList } from "./lib";

async function TodoList({ milliseconds }: { milliseconds: number }) {
  console.log(
    "getTodoList 실행:",
    typeof window === "undefined" ? "서버" : "브라우저",
  );
  const todoList = await getTodoList(milliseconds);

  return (
    <ul>
      {todoList.map((todoItem) => {
        return <li key={todoItem.id}>{todoItem.title}</li>;
      })}
    </ul>
  );
}

/**
 * 하이드레이션이 동작하는지 확인하기 위한 컴포넌트.
 * 서버에서는 초기 HTML만 만들어지고, 클라이언트에서 이벤트가 붙어야 버튼이 눌린다.
 */
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
 * 서버: renderToPipeableStream(<App />)
 * 클라이언트: hydrateRoot(document, <App />)
 *
 * 양쪽이 같은 트리를 그려야 하이드레이션이 성공한다.
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

          <Suspense fallback={<div>loading...</div>}>
            <TodoList milliseconds={2000} />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
