import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./app";

const app = new Hono();

app.get("/", () => {
  const element = createElement(App);

  // React가 쓸 Node 스트림
  const passThrough = new PassThrough();

  // Node 스트림 → 웹 스트림.
  // React는 Node 스트림에 쓰고, Response는 웹 스트림을 받는다.
  // 둘 사이를 잇는 어댑터가 필요하다.
  const reactStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    // shell이 준비되는 즉시 흘려보내기 시작한다.
    // 이 시점에 TodoList는 아직 완료되지 않았다.
    onShellReady() {
      pipe(passThrough);
    },
    onError(error) {
      console.error(error);
      passThrough.destroy();
      abort(error);
    },
  });

  // renderToPipeableStream 호출은 렌더링을 시작시킬 뿐이다.
  // 스트림을 Response에 실어 반환하는 것은 별개의 일이다.
  return new Response(reactStream, {
    headers: { "Content-Type": "text/html" },
  });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
