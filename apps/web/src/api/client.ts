export const API_BASE_URL = '/api/v1';

export type ApiEnvelope<T> = {
  requestId: string;
  code: number;
  message: string;
  data: T;
};

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as ApiEnvelope<T>;
}
