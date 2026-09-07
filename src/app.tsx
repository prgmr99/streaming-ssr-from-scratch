import { Suspense } from "react";
import { getTodoList } from "./lib";

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

/**
 * 방식 B — <html>부터 React 트리 안에 둔다.
 * 루트 컴포넌트가 <html>을 반환하면 React가 DOCTYPE을 자동으로 넣어준다.
 *
 * 선언 순서와 완료 순서를 일부러 어긋나게 배치했다.
 * B:0 → 3초 / B:1 → 0.5초 / B:2 → 1.5초
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
          <h1>Todo List</h1>

          {/* <Suspense fallback={<div>loading...</div>}>
            <TodoList milliseconds={3000} />
          </Suspense> */}

          {/* <Suspense fallback={<div>loading...</div>}>
            <TodoList milliseconds={500} />
          </Suspense> */}

          <Suspense fallback={<div>loading...</div>}>
            <TodoList milliseconds={1500} />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
