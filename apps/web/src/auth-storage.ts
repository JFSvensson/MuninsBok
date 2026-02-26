/**
 * Token storage for authentication.
 *
 * - Access token: kept in memory only (not persisted — cleared on page reload)
 * - Refresh token: persisted in localStorage so sessions survive reloads
 */

const REFRESH_TOKEN_KEY = "muninsbok_refresh_token";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

export function clearTokens(): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
