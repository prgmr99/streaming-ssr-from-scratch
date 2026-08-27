# Streaming SSR from Scratch

Streaming SSR을 프레임워크 없이 직접 구현하고, 그 과정을 설명 페이지로 정리한 기록입니다.

**→ [설명 페이지 보기](https://prgmr99.github.io/streaming-ssr-from-scratch/)**

<!-- 여기에 스크린샷이나 GIF 하나.
     loading...이 목록으로 바뀌는 화면이면 충분합니다. -->

## 왜 만들었나

<!-- 서론에 쓰신 내용을 두세 문장으로 줄여서.
     - 흰 화면 경험
     - Pages Router라 적용할 수 없었던 것
     - 그래서 직접 만들어봤다는 것 -->

## 다루는 내용

|     | 내용                                                                |
| --- | ------------------------------------------------------------------- |
| 1   | `renderToString`의 한계 — 왜 기존 API로는 스트리밍을 할 수 없는가   |
| 2   | `renderToPipeableStream`과 `onShellReady`                           |
| 3   | HTML 껍데기 붙이기 — 문자열 조립 vs React 트리                      |
| 4   | 스트리밍을 일부러 죽여보기 — 무엇이 그것을 알아채는가               |
| 5   | `onShellReady`와 `onAllReady` — 사람을 위한 응답과 기계를 위한 응답 |
| 6   | boundary가 여러 개일 때 — 자리는 선언 순으로, 내용은 완료 순으로    |
| 7   | 정리                                                                |

모든 수치는 직접 실행해서 얻은 것입니다.

## 저장소 구조

```
.
├── src/          실험용 서버 (Hono + React)
└── site/         설명 페이지 (Astro + React islands)
```

## 실행

### 실험용 서버

```bash
npm install
npm run dev
```

`http://localhost:3001`에서 확인할 수 있습니다.

스트리밍 여부는 브라우저로 봐야 정확합니다. curl로 확인하려면 `-N` 옵션이 필요합니다.

```bash
curl -N -w '\nTTFB: %{time_starttransfer}s / Total: %{time_total}s\n' localhost:3001
```

### 설명 페이지

```bash
cd site
npm install
npm run dev
```

## 사용한 것

- **서버** — Hono, React 19, tsx, Node 22
- **설명 페이지** — Astro, React, MDX

## 참고

- [mugglim / build-your-own-react-streaming-ssr](https://github.com/mugglim/build-your-own-react-streaming-ssr) — 이 프로젝트의 출발점이 된 글
- [React 공식 문서 — renderToPipeableStream](https://react.dev/reference/react-dom/server/renderToPipeableStream)
