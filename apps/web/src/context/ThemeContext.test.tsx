import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

// Mock matchMedia before importing ThemeContext
const matchMediaListeners: ((e: { matches: boolean }) => void)[] = [];
let systemDark = false;

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === "(prefers-color-scheme: dark)" ? systemDark : false,
  media: query,
  addEventListener: (_event: string, handler: (e: { matches: boolean }) => void) => {
    matchMediaListeners.push(handler);
  },
  removeEventListener: (_event: string, handler: (e: { matches: boolean }) => void) => {
    const idx = matchMediaListeners.indexOf(handler);
    if (idx >= 0) matchMediaListeners.splice(idx, 1);
  },
}));

// Mock document.documentElement.dataset
const dataset: Record<string, string> = {};

let store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};

vi.stubGlobal("localStorage", mockStorage);
vi.stubGlobal("window", {
  matchMedia: mockMatchMedia,
  localStorage: mockStorage,
});

vi.stubGlobal("document", {
  documentElement: { dataset },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

/**
 * Tests for ThemeContext verify:
 * - Default theme is "system"
 * - localStorage persistence (read and write)
 * - Resolved theme logic (system → OS preference, explicit → explicit)
 * - Invalid localStorage values fall back to "system"
 * - useTheme throws outside provider
 *
 * Note: Since the test environment is "node" (no DOM), we can't use
 * renderHook or useEffect. We test the module's pure logic via SSR
 * renders and direct function tests.
 */

describe("ThemeContext", () => {
  beforeEach(() => {
    systemDark = false;
    matchMediaListeners.length = 0;
    store = {};
    delete dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStoredTheme (via module internals)", () => {
    it("defaults to system when localStorage is empty", async () => {
      // Dynamic import to re-evaluate with clean localStorage
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let capturedTheme: string | undefined;
      function TestComponent() {
        const { theme } = useTheme();
        capturedTheme = theme;
        return null;
      }

      // SSR renders synchronously, capturing the initial state
      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(capturedTheme).toBe("system");
    });

    it("reads valid theme from localStorage", async () => {
      store.theme = "dark";
      // Re-import to pick up fresh localStorage
      vi.resetModules();
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let capturedTheme: string | undefined;
      function TestComponent() {
        const { theme } = useTheme();
        capturedTheme = theme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(capturedTheme).toBe("dark");
    });

    it("falls back to system for invalid localStorage value", async () => {
      store.theme = "garbage";
      vi.resetModules();
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let capturedTheme: string | undefined;
      function TestComponent() {
        const { theme } = useTheme();
        capturedTheme = theme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(capturedTheme).toBe("system");
    });
  });

  describe("resolvedTheme", () => {
    it("resolves system to light when OS prefers light", async () => {
      systemDark = false;
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let resolved: string | undefined;
      function TestComponent() {
        resolved = useTheme().resolvedTheme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(resolved).toBe("light");
    });

    it("resolves system to dark when OS prefers dark", async () => {
      systemDark = true;
      vi.resetModules();
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let resolved: string | undefined;
      function TestComponent() {
        resolved = useTheme().resolvedTheme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(resolved).toBe("dark");
    });

    it("resolves explicit dark regardless of OS", async () => {
      systemDark = false;
      store.theme = "dark";
      vi.resetModules();
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let resolved: string | undefined;
      function TestComponent() {
        resolved = useTheme().resolvedTheme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(resolved).toBe("dark");
    });

    it("resolves explicit light regardless of OS", async () => {
      systemDark = true;
      store.theme = "light";
      vi.resetModules();
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let resolved: string | undefined;
      function TestComponent() {
        resolved = useTheme().resolvedTheme;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));
      expect(resolved).toBe("light");
    });
  });

  describe("setTheme", () => {
    it("persists to localStorage when setTheme is called", async () => {
      const { ThemeProvider, useTheme } = await import("./ThemeContext");

      let setTheme: ((t: string) => void) | undefined;
      function TestComponent() {
        setTheme = useTheme().setTheme as (t: string) => void;
        return null;
      }

      renderToString(createElement(ThemeProvider, null, createElement(TestComponent)));

      // setTheme updates localStorage synchronously
      setTheme!("dark");
      expect(store.theme).toBe("dark");

      setTheme!("light");
      expect(store.theme).toBe("light");
    });
  });

  describe("useTheme outside provider", () => {
    it("throws an error", async () => {
      const { useTheme: useThemeImport } = await import("./ThemeContext");

      function TestComponent() {
        useThemeImport();
        return null;
      }

      expect(() => renderToString(createElement(TestComponent))).toThrow(
        "useTheme must be used within ThemeProvider",
      );
    });
  });
});
