import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import PageHead from "@/components/PageHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Dismiss the boot splash overlay (normally hidden by ConnectionSplash on the main app)
    window.__appReady = true;
    document.getElementById("splash")?.classList.remove("show");
  }, [location.pathname]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <PageHead
        title="Page not found — Limassol Fitness"
        description="This page doesn't exist. Head back to Limassol Fitness to book a personal training session in Limassol, Cyprus."
        path={location.pathname}
        noIndex
      />

      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
