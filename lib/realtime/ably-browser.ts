// browser-only dynamic loader to avoid bundling Ably's Node build
// Uses the browser-specific bundle with no Node dependencies
export async function getAbly() {
  // @ts-ignore - dynamic import of browser bundle
  const Ably = (await import('ably')).default;
  return Ably;
}
