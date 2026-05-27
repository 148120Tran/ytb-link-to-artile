export type TikTokMeta = {
  title: string;
  thumbnailUrl: string;
  authorName?: string | null;
  authorUrl?: string | null;
  videoId?: string | null;
};

function stripHashtags(value: string) {
  if (!value) {
    return "";
  }

  const withoutTags = value
    .replace(/(^|\s)#[^\s#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutTags;
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  Accept: "application/json",
};

export async function getTikTokMeta(url: string): Promise<TikTokMeta> {
  const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const response = await fetch(oEmbedUrl, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    throw new Error(`TikTok oEmbed failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    title?: string;
    thumbnail_url?: string;
    author_name?: string;
    author_url?: string;
    embed_product_id?: string;
  };

  return {
    title: stripHashtags(data.title ?? ""),
    thumbnailUrl: data.thumbnail_url ?? "",
    authorName: data.author_name ?? null,
    authorUrl: data.author_url ?? null,
    videoId: data.embed_product_id ?? null,
  };
}
