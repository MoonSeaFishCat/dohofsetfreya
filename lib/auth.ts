// 简单的认证工具（生产环境应使用更安全的方案）
export const AUTH_CREDENTIALS = {
  username: 'xiya',
  password: 'xiya50491',
};

export function validateCredentials(username: string, password: string): boolean {
  return username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password;
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
