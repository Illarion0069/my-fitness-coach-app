import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/errorReporter";
import AppErrorBoundary from "@/components/AppErrorBoundary";

installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
