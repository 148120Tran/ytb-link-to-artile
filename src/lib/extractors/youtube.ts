import { YoutubeTranscript } from "youtube-transcript";

export type YouTubeMeta = {
  title: string;
  thumbnailUrl: string;
  authorName?: string | null;
  authorUrl?: string | null;
};

export async function getYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const response = await fetch(oEmbedUrl);

  if (!response.ok) {
    throw new Error(`YouTube oEmbed failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    title: string;
    thumbnail_url: string;
    author_name?: string;
    author_url?: string;
  };

  return {
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    authorName: data.author_name ?? null,
    authorUrl: data.author_url ?? null,
  };
}

export async function getYouTubeTranscript(videoId: string) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const text = transcript.map((entry) => entry.text).join(" ");
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}
