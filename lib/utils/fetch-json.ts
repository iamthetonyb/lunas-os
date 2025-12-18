type FetchJSONOptions<T = unknown> = RequestInit & {
  timeoutMs?: number;
  emptyValue?: T;
};

export async function fetchJSON<T>(
  input: RequestInfo | URL,
  init: FetchJSONOptions<T> = {}
): Promise<T> {
  const { timeoutMs = 30000, headers, signal, emptyValue, ...rest } = init;
  const controller = signal ? null : new AbortController();
  const timeoutId =
    timeoutMs && !signal && controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetch(input, {
      ...rest,
      signal: signal ?? controller?.signal,
      headers: {
        Accept: 'application/json',
        ...(headers ?? {}),
      },
    });

    if (response.status === 401 && typeof window !== 'undefined') {
      const cb = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?callbackUrl=${cb}`;
      throw new Error('Unauthorized');
    }

    if (response.status === 204) {
      return (emptyValue ?? (null as T)) as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJSON = contentType.includes('application/json');
    const parseBody = async () => {
      if (isJSON) return response.json();
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    };

    const data = await parseBody();

    if (!response.ok) {
      console.error('Request failed with status', response.status, 'and data:', data);
      let message = 'Request failed';
      let details = null;

      if (data && typeof data === 'object' && data !== null) {
        if ('error' in data) {
          if (typeof data.error === 'string' && data.error) {
            message = data.error;
          } else if (typeof data.error === 'object' && data.error && 'message' in data.error) {
            message = String(data.error.message || 'Request failed');
          }
        }
        if ('details' in data) {
          details = data.details;
        }
      } else if (response.statusText) {
        message = response.statusText;
      }

      // If we got a 500 with no useful data, make it more descriptive
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        message = `Server error (${response.status}): The server encountered an error. Check server logs for details.`;
        details = 'No error details returned from server';
      }

      const error = new Error(message);
      (error as Error & { status?: number; data?: unknown }).status = response.status;
      (error as Error & { status?: number; data?: unknown }).data = data || { error: message, details };
      throw error;
    }

    if (!isJSON) {
      throw new Error('Unexpected non-JSON response');
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
