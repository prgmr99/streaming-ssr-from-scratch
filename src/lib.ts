export type TodoItem = {
  id: string;
  title: string;
};

export async function getTodoList(): Promise<TodoItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: "1", title: "Buy groceries" },
        { id: "2", title: "Read a book" },
        { id: "3", title: "Write a blog post" },
      ]);
    }, 2000);
  });
}
