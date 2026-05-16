function isYouTubeHost(hostname: string) {
  return (
    hostname === "youtu.be" ||
    hostname.endsWith(".youtu.be") ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  );
}

function cleanId(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value.split(/[?&#]/)[0].trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function parseYouTubeId(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isYouTubeHost(hostname)) {
    return null;
  }

  if (hostname.includes("youtu.be")) {
    return cleanId(parsed.pathname.replace("/", ""));
  }

  const vParam = cleanId(parsed.searchParams.get("v"));
  if (vParam) {
    return vParam;
  }

  const pathMatch = parsed.pathname.match(/\/(embed|shorts|v|live)\/([^/?#]+)/);
  if (pathMatch) {
    return cleanId(pathMatch[2]);
  }

  return null;
}
