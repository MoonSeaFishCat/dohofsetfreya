import { settingsStore } from './settings-store';

export { settingsStore };

export function setAuthToken() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('dns_auth_token', 'authenticated');
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('dns_auth_token');
  }
}

export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('dns_auth_token') === 'authenticated';
  }
  return false;
}
