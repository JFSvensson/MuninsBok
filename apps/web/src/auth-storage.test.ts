import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAccessToken, setTokens, clearTokens, onSessionExpired } from "./auth-storage";

describe("auth-storage", () => {
  beforeEach(() => {
    clearTokens();
  });

  describe("getAccessToken", () => {
    it("returns null initially", () => {
      expect(getAccessToken()).toBeNull();
    });

    it("returns access token after setTokens", () => {
      setTokens("access123");
      expect(getAccessToken()).toBe("access123");
    });
  });

  describe("setTokens", () => {
    it("stores access token in memory", () => {
      setTokens("myAccess");
      expect(getAccessToken()).toBe("myAccess");
    });
  });

  describe("clearTokens", () => {
    it("clears access token", () => {
      setTokens("a");
      clearTokens();
      expect(getAccessToken()).toBeNull();
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
