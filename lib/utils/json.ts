export function json(data: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === 'number' ? init : init.status ?? 200;
  const headers =
    typeof init === 'number'
      ? {}
      : (init.headers as HeadersInit | undefined) ?? {};

  return new Response(JSON.stringify(data ?? null), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}
