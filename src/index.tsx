import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-hosted webfonts, bundled by Vite — match the old Google Fonts weights and
// work offline in the Tauri webview (Inter for --font-sans, JetBrains Mono for --font-mono).
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "katex/dist/katex.min.css";
import "./index.css";

// Suppress ResizeObserver loop errors which are common in deep flex/React-Flow/Plotly layouts
if (typeof window !== 'undefined') {
  const originalError = window.console.error;
  window.console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('ResizeObserver')) return;
    originalError.apply(window.console, args);
  };
  
  window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  const _ResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  };
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
