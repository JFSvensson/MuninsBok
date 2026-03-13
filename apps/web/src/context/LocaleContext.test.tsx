import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleProvider, useLocale } from "./LocaleContext";

function TestComponent() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t("common.save")}</span>
      <button onClick={() => setLocale("en")}>Switch to EN</button>
      <button onClick={() => setLocale("sv")}>Switch to SV</button>
    </div>
  );
}

const storageMap = new Map<string, string>();

beforeEach(() => {
  storageMap.clear();
});

const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
};

vi.stubGlobal("localStorage", localStorageMock);

describe("LocaleContext", () => {
  it("defaults to Swedish locale", () => {
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("sv");
    expect(screen.getByTestId("translated").textContent).toBe("Spara");
  });

  it("switches to English when setLocale is called", () => {
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByText("Switch to EN"));
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("translated").textContent).toBe("Save");
  });

  it("switches back to Swedish", () => {
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByText("Switch to EN"));
    fireEvent.click(screen.getByText("Switch to SV"));
    expect(screen.getByTestId("locale").textContent).toBe("sv");
    expect(screen.getByTestId("translated").textContent).toBe("Spara");
  });

  it("persists locale choice to localStorage", () => {
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByText("Switch to EN"));
    expect(localStorage.getItem("muninsbok-locale")).toBe("en");
  });

  it("restores locale from localStorage", () => {
    localStorage.setItem("muninsbok-locale", "en");
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("translated").textContent).toBe("Save");
  });

  it("throws when useLocale is used outside provider", () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      "useLocale must be used within a LocaleProvider",
    );
    spy.mockRestore();
  });
});
