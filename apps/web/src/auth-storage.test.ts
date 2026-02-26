import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  onSessionExpired,
} from "./auth-storage";

describe("auth-storage", () => {
  // Mock localStorage
  const store: Record<string, string> = {};
  beforeEach(() => {
    // Clear in-memory access token by clearing + re-importing won't work,
    // so we call clearTokens() to reset state between tests
    clearTokens();
    for (const key of Object.keys(store)) delete store[key];

    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    });
  });

  describe("getAccessToken", () => {
    it("returns null initially", () => {
      expect(getAccessToken()).toBeNull();
    });

    it("returns access token after setTokens", () => {
      setTokens("access123", "refresh456");
      expect(getAccessToken()).toBe("access123");
    });
  });

  describe("getRefreshToken", () => {
    it("returns null when no token stored", () => {
      expect(getRefreshToken()).toBeNull();
    });

    it("returns refresh token after setTokens", () => {
      setTokens("access123", "refresh456");
      expect(getRefreshToken()).toBe("refresh456");
    });

    it("reads from localStorage", () => {
      setTokens("a", "refresh-from-storage");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "muninsbok_refresh_token",
        "refresh-from-storage",
      );
    });
  });

  describe("setTokens", () => {
    it("stores access token in memory and refresh token in localStorage", () => {
      setTokens("myAccess", "myRefresh");

      expect(getAccessToken()).toBe("myAccess");
      expect(localStorage.setItem).toHaveBeenCalledWith("muninsbok_refresh_token", "myRefresh");
    });
  });

  describe("clearTokens", () => {
    it("clears both access and refresh tokens", () => {
      setTokens("a", "r");
      clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith("muninsbok_refresh_token");
    });
  });

  describe("localStorage unavailable", () => {
    it("getRefreshToken returns null if localStorage throws", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      expect(getRefreshToken()).toBeNull();
    });

    it("setTokens does not throw if localStorage throws", () => {
      vi.stubGlobal("localStorage", {
        getItem: vi.fn(),
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
        removeItem: vi.fn(),
      });

      expect(() => setTokens("a", "r")).not.toThrow();
      // Access token still stored in memory
      expect(getAccessToken()).toBe("a");
    });

    it("clearTokens does not throw if localStorage throws", () => {
      vi.stubGlobal("localStorage", {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: () => {
          throw new Error("SecurityError");
        },
      });

      expect(() => clearTokens()).not.toThrow();
    });
  });

  describe("onSessionExpired", () => {
    it("calls callback when clearTokens is called with notify: true", () => {
      const cb = vi.fn();
      onSessionExpired(cb);

      clearTokens({ notify: true });

      expect(cb).toHaveBeenCalledOnce();
    });

    it("does not call callback when clearTokens is called without notify", () => {
      const cb = vi.fn();
      onSessionExpired(cb);

      clearTokens();

      expect(cb).not.toHaveBeenCalled();
    });

    it("does not call callback when notify is false", () => {
      const cb = vi.fn();
      onSessionExpired(cb);

      clearTokens({ notify: false });

      expect(cb).not.toHaveBeenCalled();
    });

    it("unsubscribes when returned function is called", () => {
      const cb = vi.fn();
      const unsubscribe = onSessionExpired(cb);

      unsubscribe();
      clearTokens({ notify: true });

      expect(cb).not.toHaveBeenCalled();
    });

    it("replaces previous callback when called again", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      onSessionExpired(cb1);
      onSessionExpired(cb2);

      clearTokens({ notify: true });

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });
});
