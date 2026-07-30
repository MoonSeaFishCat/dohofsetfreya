export const AUTH_COOKIE_NAME = 'doh_auth_token';
export const CLIENT_AUTH_STORAGE_KEY = 'dns_auth_token';
export const CLIENT_AUTH_VALUE = 'authenticated';

export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(CLIENT_AUTH_STORAGE_KEY) === CLIENT_AUTH_VALUE;
  }
  return false;
}

export function setAuthToken() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CLIENT_AUTH_STORAGE_KEY, CLIENT_AUTH_VALUE);
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(CLIENT_AUTH_STORAGE_KEY);
  }
}