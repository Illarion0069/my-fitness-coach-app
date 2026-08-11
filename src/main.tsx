import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/errorReporter";
import { installClickTracking } from "@/lib/analytics";
import AppErrorBoundary from "@/components/AppErrorBoundary";

installGlobalErrorReporting();
installClickTracking();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </AppErrorBoundary>
);
