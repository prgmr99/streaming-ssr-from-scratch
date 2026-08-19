import { hydrateRoot } from "react-dom/client";
import App from "./app";

/**
 * 브라우저 진입점.
 *
 * createRoot가 아니라 hydrateRoot를 쓴다.
 * - createRoot: 빈 DOM에 처음부터 그린다
 * - hydrateRoot: 이미 있는 DOM을 재사용하고 이벤트만 붙인다
 *
 * 첫 번째 인자가 document인 이유:
 * App이 <html>부터 반환하므로(2단계 방식 B) 컨테이너도 문서 전체가 되어야 한다.
 * 방식 A였다면 document.getElementById("root")를 넘겼을 것이다.
 */
hydrateRoot(document, <App />);
