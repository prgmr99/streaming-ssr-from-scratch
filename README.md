# Streaming SSR from Scratch

React의 Streaming SSR을 프레임워크 없이 직접 구현하고, 그 과정을 설명 페이지로 정리한 기록입니다.

**→ [설명 페이지 보기](https://prgmr99.github.io/streaming-ssr-from-scratch/)**

<!-- 여기에 GIF 또는 스크린샷.
     loading... 세 개가 순차적으로 목록으로 바뀌는 3초짜리면 충분합니다. -->

## 배경

처음 Server Side Rendering을 접했던 것은 Next.js의 getServerSideProps를 통해서였습니다. 서버에서 HTML을 만들어 보내는데, 사용자는 한동안 빈 화면만 보고 있었습니다.

그러다 다른 서비스들의 기술 블로그와 발표 영상을 보면서 Streaming SSR을 알게 되었습니다. 사내 프로젝트에 적용해보고 싶었지만 Next.js 14 Pages Router라 방법이 없었고, 그래서 프레임워크 없이 직접 만들어보기로 했습니다.

## 다루는 내용

|     | 제목                               | 내용                                                |
| --- | ---------------------------------- | --------------------------------------------------- |
| 1   | renderToString의 한계              | 왜 기존 SSR API로는 스트리밍을 할 수 없는가         |
| 2   | 스트리밍으로 바꾸기                | `renderToPipeableStream`과 `onShellReady`           |
| 3   | HTML 껍데기 붙이기                 | 문자열로 조립할 것인가, React 트리 안에 넣을 것인가 |
| 4   | 스트리밍이 죽어도 티가 나지 않는다 | 출력도 TTFB도 정상인데 화면만 다른 경우             |
| 5   | onShellReady와 onAllReady          | 사람을 위한 응답과 기계를 위한 응답                 |
| 6   | boundary가 여러 개일 때            | 자리는 선언 순으로, 내용은 완료 순으로              |
| 7   | 정리                               | 직접 만들며 알게 된 것들                            |

모든 수치는 직접 실행해서 얻은 것입니다.

## 저장소 구조

```
.
├── src/          실험용 서버 (Hono + React)
└── site/         설명 페이지 (Astro + React islands)
```

두 프로젝트가 각각 `package.json`을 가집니다. 실행할 때 디렉터리를 확인하세요.

## 실행

Node 20 이상이 필요합니다. (`Readable.toWeb`)

### 실험용 서버

저장소 루트에서 실행합니다.

```bash
npm install
npm run dev
```

→ http://localhost:3001

브라우저로 열면 세 영역이 0.5초, 1.5초, 3초에 각각 채워집니다.
가운데가 먼저, 아래가 다음, 맨 위가 마지막입니다.

응답 원문과 타이밍을 보려면:

```bash
curl -N -w '\nTTFB: %{time_starttransfer}s / Total: %{time_total}s\n' localhost:3001
```

`-N`은 `--no-buffer`의 축약형입니다. curl이 받은 내용을 도착하는 대로 출력합니다.

> 저장소 코드는 **6장 시점 상태**입니다.
> 2~5장의 응답은 boundary가 하나였을 때의 것이라 지금 코드와 다릅니다.

### 따라 해보기

각 장의 코드는 글에 전부 실려 있습니다. 클론한 뒤 글을 보며 직접 고쳐보시면 됩니다.

특히 아래 두 가지는 **한 줄만 바꾸면** 확인할 수 있습니다.

| 장  | 바꾸는 곳                                             | 무엇을 보게 되는가                           |
| --- | ----------------------------------------------------- | -------------------------------------------- |
| 4   | `controller.enqueue(value)`를 배열에 모았다가 한 번에 | 응답도 TTFB도 그대로인데 화면만 달라진다     |
| 5   | `onShellReady`를 `onAllReady`로                       | fallback과 교체 스크립트가 응답에서 사라진다 |

`curl`보다 **브라우저로 확인하는 편이 정확합니다.**
스트리밍이 죽었는지는 숫자가 아니라 화면에서 드러납니다.

### 설명 페이지

`site` 디렉터리에서 실행합니다.

```bash
cd site
npm install
npm run dev
```

→ http://localhost:4321/streaming-ssr-from-scratch/

`base` 경로가 설정되어 있어 루트(`/`)로 접속하면 404가 납니다.

## 사용한 것

- **실험용 서버** — Hono, React 19, tsx
- **설명 페이지** — Astro, React, MDX

## 참고

- [mugglim / build-your-own-react-streaming-ssr](https://github.com/mugglim/build-your-own-react-streaming-ssr) — 이 프로젝트의 출발점이 된 글
- [React 공식 문서 — renderToPipeableStream](https://react.dev/reference/react-dom/server/renderToPipeableStream)
- [Basic Fizz Architecture (facebook/react#20970)](https://github.com/facebook/react/pull/20970) — `B`, `S` 접두어의 유래
