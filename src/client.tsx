import { Suspense } from "react";
import { getTodoList } from "./lib";

async function TodoList() {
  const todoList = await getTodoList();

  return (
    <ul>
      {todoList.map((todoItem) => {
        return <li key={todoItem.id}>{todoItem.title}</li>;
      })}
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
