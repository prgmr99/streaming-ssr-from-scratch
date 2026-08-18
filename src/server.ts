import ReactDomServer from "react-dom/server";
import { Hono } from "hono";
import { createElement } from "react";
import App from "./client";
import { PassThrough, Readable } from "node:stream";
import { serve } from "@hono/node-server";

// 1단계 코드
const app = new Hono();

app.get("/", (ctx) => {
  const element = createElement(App);

  const passThrough = new PassThrough();
  const webStream = Readable.toWeb(passThrough);

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    onAllReady: () => {
      pipe(passThrough);
    },
    onError: (error) => {
      console.error(error);
      passThrough.destroy();
      abort(error);
    },
  });

  return new Response(webStream as ReadableStream, {
    headers: { "Content-Type": "text/html" },
  });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
