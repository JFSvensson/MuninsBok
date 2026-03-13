import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("./ErrorBoundary.module.css", () => ({
  default: { errorBoundary: "errorBoundary", content: "content" },
}));

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Child content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error from React's error boundary logging
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders error fallback when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Något gick fel")).toBeInTheDocument();
    expect(screen.getByText("Ett oväntat fel uppstod. Försök ladda om sidan.")).toBeInTheDocument();
  });

  it("shows technical details with error message", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Teknisk information")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("recovers when 'Försök igen' is clicked", async () => {
    const user = userEvent.setup();

    // We need a component that can toggle throwing
    let shouldThrow = true;
    function Toggler() {
      if (shouldThrow) throw new Error("Boom");
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Något gick fel")).toBeInTheDocument();

    // Stop throwing before resetting
    shouldThrow = false;

    await user.click(screen.getByText("Försök igen"));

    // Re-render with non-throwing child
    rerender(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("shows 'Gå till startsidan' button", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Gå till startsidan")).toBeInTheDocument();
  });
});
