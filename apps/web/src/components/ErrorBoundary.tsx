import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Något gick fel</h2>
            <p>Ett oväntat fel uppstod. Försök ladda om sidan.</p>
            {this.state.error && (
              <details>
                <summary>Teknisk information</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex gap-1" style={{ marginTop: "1rem" }}>
              <button onClick={this.handleReset}>Försök igen</button>
              <button
                className="secondary"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Gå till startsidan
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
