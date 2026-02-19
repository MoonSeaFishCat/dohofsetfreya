const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';

export function validateCredentials(username: string, password: string): boolean {
  return username === AUTH_USERNAME && password === AUTH_PASSWORD;
}

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
