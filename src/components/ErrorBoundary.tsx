import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  // Use inline styles to avoid dependency on Tailwind (which might have errored)
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "48px 24px", textAlign: "center", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, backgroundColor: "#FFE4E9",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#2B1318", marginBottom: 6 }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: 13, color: "#6E4E57", marginBottom: 20, maxWidth: 300 }}>
        An unexpected error occurred. Please try again.
      </p>
      <button onClick={onReset} style={{
        padding: "10px 28px", borderRadius: 14, fontSize: 13, fontWeight: 700,
        color: "white", border: "none", cursor: "pointer",
        background: "linear-gradient(to right, #FB7185, #E11D48)",
      }}>
        Try Again
      </button>
      {error && (
        <details style={{ marginTop: 20, fontSize: 11, color: "#6E4E57", maxWidth: 400, textAlign: "left" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Error Details</summary>
          <pre style={{
            marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: "#FBE8EE",
            overflow: "auto", fontSize: 10, lineHeight: 1.5,
          }}>{error.message}{error.stack ? `\n\n${error.stack}` : ""}</pre>
        </details>
      )}
    </div>
  );
}
