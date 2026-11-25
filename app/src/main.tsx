import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./lib/ErrorBoundary";
import { startPresenceLink } from "./presenceLink";

// Last line of defence: a stray rejected promise must never take the window down.
addEventListener("unhandledrejection", (e) => { e.preventDefault(); console.warn("[luminos] unhandled rejection:", e.reason); });

createRoot(document.getElementById("root")!).render(
  <StrictMode><ErrorBoundary label="Luminos"><App /></ErrorBoundary></StrictMode>,
);
try { startPresenceLink(); } catch (e) { console.warn("[luminos] presence link unavailable:", e); }
