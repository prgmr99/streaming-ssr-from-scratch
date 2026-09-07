export type TodoItem = {
  id: string;
  title: string;
};

/**
 * 임의로 지연시킨 데이터 조회.
 * 지연 시간을 인자로 받아 boundary마다 다른 속도를 만든다.
 */
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
