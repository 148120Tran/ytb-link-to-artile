export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not set." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const body = await response.text();
      return Response.json(
        { error: `List models failed: ${response.status}`, body },
        { status: 500 }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list models.";
    return Response.json({ error: message }, { status: 500 });
  }
}
