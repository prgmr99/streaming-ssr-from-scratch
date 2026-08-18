import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./client";

const app = new Hono();

const textEncoder = new TextEncoder();

/**
 * React는 <!DOCTYPE html>을 렌더링할 수 없다.
 * DOCTYPE은 태그가 아니라 문서 선언이라 React 엘리먼트로 표현이 불가능하다.
 * 따라서 스트림 맨 앞에 한 줄만 직접 끼워 넣는다.
 */
const DOCTYPE = "<!DOCTYPE html>";

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

  const responseStream = new ReadableStream({
    async start(controller) {
      // [1] DOCTYPE만 먼저
      controller.enqueue(textEncoder.encode(DOCTYPE));

      // [2] 나머지는 React가 전부 담당 (<html> ~ </html>)
      const reader = reactStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        // [3] trailer 없음. </html>은 React가 닫아준다.
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/html" },
  });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
