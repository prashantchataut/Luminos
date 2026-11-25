import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { isTauri } from "./api";
import { startPresenceLink } from "./presenceLink";

createRoot(document.getElementById("root")!).render(<App />);
startPresenceLink();

// Tell the shell the first frame is on screen (used by CI to measure cold start).
if (isTauri) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => invoke("app_ready")).catch(() => {});
  }));
}
