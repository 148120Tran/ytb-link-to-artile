import { getOpenGraphMeta, OpenGraphMeta } from "@/lib/extractors/generic";
import { getTikTokMeta } from "@/lib/extractors/tiktok";
import { getYouTubeMeta, getYouTubeTranscript } from "@/lib/extractors/youtube";
import { isTikTokUrl } from "@/lib/tiktok-utils";
import { parseYouTubeId } from "@/lib/youtube-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: { url?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const url = payload.url?.trim();
  if (!url) {
    return Response.json({ error: "Missing url." }, { status: 400 });
  }

  try {
    const videoId = parseYouTubeId(url);
    if (videoId) {
      const [meta, transcript] = await Promise.all([
        getYouTubeMeta(videoId),
        getYouTubeTranscript(videoId),
      ]);
      const ogMeta = await getOpenGraphMeta(url).catch((): OpenGraphMeta => ({}));

      const title = meta.title || ogMeta.title || "Untitled video";
      const thumbnailUrl = meta.thumbnailUrl || ogMeta.image || "";
      const description = ogMeta.description || "";
      const transcriptAvailable = Boolean(transcript && transcript.trim());
      const content = transcriptAvailable
        ? transcript!
        : [title, description].filter(Boolean).join("\n\n");

      return Response.json({
        title,
        thumbnailUrl,
        content,
        platform: "youtube",
        originalUrl: url,
        transcriptAvailable,
        videoId,
      });
    }

    if (isTikTokUrl(url)) {
      const [meta, ogMeta] = await Promise.all([
        getTikTokMeta(url).catch(() => null),
        getOpenGraphMeta(url).catch((): OpenGraphMeta => ({})),
      ]);

      const title = meta?.title || ogMeta.title || "Untitled TikTok";
      const thumbnailUrl = meta?.thumbnailUrl || ogMeta.image || "";
      const description = ogMeta.description || "";
      const content = [title, description].filter(Boolean).join("\n\n");
      const videoId = meta?.videoId || undefined;

      return Response.json({
        title,
        thumbnailUrl,
        content,
        platform: "tiktok",
        originalUrl: url,
        transcriptAvailable: false,
        videoId,
      });
    }

    const ogMeta = await getOpenGraphMeta(url).catch((): OpenGraphMeta => ({}));
    const title = ogMeta.title || "Untitled link";
    const thumbnailUrl = ogMeta.image || "";
    const description = ogMeta.description || "";
    const content = [title, description].filter(Boolean).join("\n\n");

    return Response.json({
      title,
      thumbnailUrl,
      content,
      platform: "generic",
      originalUrl: url,
      transcriptAvailable: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract metadata.";
    return Response.json({ error: message }, { status: 500 });
  }
}
