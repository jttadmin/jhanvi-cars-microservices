export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'jhanvi_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/** App.tsx calls this once on mount so an expired/invalid JWT anywhere logs
 * the user out and drops them back on the login screen. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
  onSessionExpired = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Set false for register/login, which run before a token exists. */
  auth?: boolean;
}

const USER_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please log in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'That conflicts with an existing booking or ride.',
  422: 'Some details are missing or invalid.',
  429: 'Too many requests — please slow down and try again.',
  500: 'Something went wrong on our end. Please try again shortly.',
};

/**
 * All requests go through nginx at /api/... — never call a service port
 * (e.g. localhost:3004) directly from the browser.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0);
  }

  if (response.status === 401 && auth) {
    clearToken();
    onSessionExpired?.();
    throw new ApiError(USER_MESSAGES[401], 401);
  }

  if (!response.ok) {
    let message = USER_MESSAGES[response.status] ?? 'Unexpected error. Please try again.';

    try {
      const data = await response.json();

      if (typeof data.message === 'string') {
        message = data.message;
      } else if (Array.isArray(data.errors)) {
        message = data.errors.join(', ');
      } else if (data.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Keep the generic status message if the response isn't JSON.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
