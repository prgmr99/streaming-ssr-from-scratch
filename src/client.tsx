import { Suspense } from "react";
import { getTodoList } from "./lib";

async function TodoList({ milliseconds }: { milliseconds: number }) {
  const todoList = await getTodoList(milliseconds);

  return (
    <ul>
      {todoList.map((todoItem) => {
        return <li key={todoItem.id}>{todoItem.title}</li>;
      })}
    </ul>
  );
}

function Slow() {
  return <TodoList milliseconds={3000} />;
}

function Fast() {
  return <TodoList milliseconds={500} />;
}

function Medium() {
  return <TodoList milliseconds={1500} />;
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
            <Slow />
          </Suspense>
          <Suspense fallback={<div>loading...</div>}>
            <Fast />
          </Suspense>
          <Suspense fallback={<div>loading...</div>}>
            <Medium />
          </Suspense>
        </div>
      </body>
    </html>
  );
}

export default App;
