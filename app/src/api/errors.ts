/** Normalised failure from the API layer; UI code only ever sees this shape. */
export class ApiError extends Error {
  constructor(
    public readonly kind: 'network' | 'http' | 'config',
    message: string,
    public readonly status = 0,
    public readonly code = kind === 'network' ? 'network' : 'unknown',
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turns a backend error body ({error:{code,message,details}}) into an ApiError. */
export function fromResponseBody(status: number, body: unknown): ApiError {
  const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(e?.details)) {
    for (const d of e.details as { path?: unknown[]; message?: string }[]) {
      const key = String(d.path?.[0] ?? '');
      if (key && d.message && !fieldErrors[key]) fieldErrors[key] = d.message;
    }
  }
  const fallback = status >= 500 ? 'The server had a problem. Try again in a moment.' : 'Something went wrong.';
  return new ApiError('http', e?.message ?? fallback, status, e?.code ?? 'unknown', fieldErrors);
}

/** User-facing sentence for any thrown value. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'network') return 'Can’t reach the server. Check your connection and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
