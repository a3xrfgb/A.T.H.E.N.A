import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nContext";
import { FIRST_LAUNCH_ONBOARDING_KEY } from "./lib/firstLaunchOnboarding";
import "./index.css";

/** Dev only: open with `?resetOnboarding=1` to clear first-launch flag and reload (WebView locks disk storage while running). */
if (import.meta.env.DEV && typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search);
  if (q.has("resetOnboarding")) {
    try {
      localStorage.removeItem(FIRST_LAUNCH_ONBOARDING_KEY);
    } catch {
      /* ignore */
    }
    window.location.replace(`${window.location.origin}${window.location.pathname}`);
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
