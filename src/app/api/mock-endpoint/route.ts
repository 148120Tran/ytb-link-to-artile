export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const entries: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      entries[key] = {
        filename: value.name,
        type: value.type,
        size: value.size,
      };
    } else {
      entries[key] = value;
    }
  }

  console.log("Mock endpoint received:", entries);

  return Response.json({ ok: true, received: entries });
}
