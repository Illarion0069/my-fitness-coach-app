import React from "react";
import { reportClientError } from "@/lib/errorReporter";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClientError({
      message: error.message,
      stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}`,
      source: "react-error-boundary",
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Что-то пошло не так</h1>
        <p className="text-muted-foreground max-w-sm">
          Мы уже получили уведомление об ошибке. Попробуйте перезагрузить страницу.
        </p>
        <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
      </div>
    );
  }
}

export default AppErrorBoundary;
