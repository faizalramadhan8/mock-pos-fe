import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply persisted dark mode before first render to prevent flash
try {
  const theme = JSON.parse(localStorage.getItem("bakeshop-theme") || "{}");
  if (theme?.state?.dark) document.documentElement.classList.add("dark");
} catch { /* ignore parse errors */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
