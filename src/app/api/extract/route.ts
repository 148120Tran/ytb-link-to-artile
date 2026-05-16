import { getOpenGraphMeta } from "@/lib/extractors/generic";
import { getYouTubeMeta, getYouTubeTranscript } from "@/lib/extractors/youtube";
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
      const ogMeta = await getOpenGraphMeta(url).catch(() => ({}));

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

    const ogMeta = await getOpenGraphMeta(url);
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
