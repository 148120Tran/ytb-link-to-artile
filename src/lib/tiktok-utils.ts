function isTikTokHost(hostname: string) {
  return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
}

export function isTikTokUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  return isTikTokHost(parsed.hostname.toLowerCase());
}
