import { generateArticle } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: { content?: string; customPrompt?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const content = payload.content?.trim();
  if (!content) {
    return Response.json({ error: "Missing content." }, { status: 400 });
  }

  try {
    const article = await generateArticle(content, payload.customPrompt);
    return Response.json({ article });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate article.";
    return Response.json({ error: message }, { status: 500 });
  }
}
