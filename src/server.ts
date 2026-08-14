import ReactDomServer from "react-dom/server";
import { Hono } from "hono";
import { createElement } from "react";
import App from "./client";
import { PassThrough, Readable } from "node:stream";
import { serve } from "@hono/node-server";

// 1단계 코드
const app = new Hono();

// app.get("/", (ctx) => {
//   const element = createElement(App);

//   const passThrough = new PassThrough();
//   const webStream = Readable.toWeb(passThrough);

//   const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
//     onShellReady: () => {
//       pipe(passThrough);
//     },
//     onError: (error) => {
//       console.error(error);
//       passThrough.destroy();
//       abort(error);
//     },
//   });

//   return new Response(webStream as ReadableStream, {
//     headers: { "Content-Type": "text/html" },
//   });
// });

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

// 2단계 코드
const header = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Streaming SSR</title></head><body><div id="root">`;
const trailer = `</div></body></html>`;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const decodeChunk = (chunk: unknown) => {
  if (chunk instanceof Uint8Array) {
    return textDecoder.decode(chunk);
  }
  return String(chunk);
};

app.get("/", (ctx) => {
  const element = createElement(App);

  const passThrough = new PassThrough();
  const reactStream = Readable.toWeb(passThrough); // 1단계와 동일

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
      // [1] header 내보내기
      controller.enqueue(textEncoder.encode(header));

      // [2] React stream — 오는 대로 즉시 통과
      const reader = reactStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // 관찰용: chunk가 몇 번에 나뉘어 오는지 보고 싶을 때 주석 해제
          console.log("[chunk]", decodeChunk(value));
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        // [3] trailer — 에러가 나도 반드시 닫는다
        controller.enqueue(textEncoder.encode(trailer));
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/html" },
  });
});
