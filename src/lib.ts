export type TodoItem = {
  id: string;
  title: string;
};

export async function getTodoList(
  milliseconds: number = 2000,
): Promise<TodoItem[]> {
  console.log("getTodoList 진입");
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
