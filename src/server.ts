import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createElement } from "react";
import { PassThrough, Readable } from "node:stream";
import ReactDomServer from "react-dom/server";
import App from "./app";

const app = new Hono();

/**
 * 번들 파일 서빙.
 * esbuild가 만든 public/client.js를 /client.js 경로로 내보낸다.
 */
app.use("/client.js", serveStatic({ root: "./public" }));

app.get("/", () => {
  const element = createElement(App);

  const passThrough = new PassThrough();
  const reactStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(element, {
    /**
     * bootstrapModules
     * React가 이 경로를 <script type="module">로 만들어 스트림에 직접 끼워 넣는다.
     * 우리가 <script> 태그를 손으로 쓸 필요가 없다.
     *
     * (일반 script로 넣으려면 bootstrapScripts)
     */
    bootstrapModules: ["/client.js"],

    onShellReady() {
      pipe(passThrough);
    },
    onError(error) {
      console.error(error);
      passThrough.destroy();
      abort(error);
    },
  });

  return new Response(reactStream, {
    headers: { "Content-Type": "text/html" },
  });
});

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
