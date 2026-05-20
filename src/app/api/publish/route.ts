import { buildRichHtml } from "@/lib/html-builder";
import { LIVEWIRE_SNAPSHOT_OVERRIDE } from "@/lib/livewire-snapshot";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIVEWIRE_PAGE_URL =
  "https://runwaytimes.cafex.biz/backend/posts";
const DEFAULT_LIVEWIRE_COMPONENT = "post-manager-component";
const DEFAULT_LIVEWIRE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type LivewireInitialData = {
  fingerprint: Record<string, unknown>;
  serverMemo: Record<string, unknown>;
};

type LivewireParseResult = {
  initialData: LivewireInitialData;
  csrfToken: string | null;
};

type LivewireSnapshot = {
  data: Record<string, unknown>;
  memo: Record<string, unknown>;
  checksum: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mergeServerMemo(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const baseData = isPlainObject(base["data"]) ? base["data"] : {};
  const patchData = isPlainObject(patch["data"]) ? patch["data"] : {};

  return {
    ...base,
    ...patch,
    data: {
      ...baseData,
      ...patchData,
    },
  };
}

function isLivewireTarget(targetUrl: string) {
  return targetUrl.includes("/livewire/message/");
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function buildInitialDataFromSnapshot(
  snapshot: LivewireSnapshot
): LivewireInitialData {
  const fingerprint = {
    id: snapshot.memo?.["id"],
    name: snapshot.memo?.["name"],
    locale: snapshot.memo?.["locale"] ?? "en",
    path: snapshot.memo?.["path"],
    method: snapshot.memo?.["method"] ?? "GET",
    v: snapshot.memo?.["v"] ?? snapshot.memo?.["version"] ?? "acj",
  };
  const serverMemo = {
    children: snapshot.memo?.["children"] ?? [],
    errors: snapshot.memo?.["errors"] ?? [],
    htmlHash: snapshot.memo?.["htmlHash"] ?? "",
    data: snapshot.data ?? {},
    dataMeta: snapshot.memo?.["dataMeta"] ?? [],
    checksum: snapshot.checksum,
  };

  return { fingerprint, serverMemo };
}

function parseLivewireOverride(raw: unknown): LivewireInitialData {
  if (typeof raw === "string") {
    const decoded = decodeHtmlAttribute(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    if (parsed && "fingerprint" in parsed && "serverMemo" in parsed) {
      return parsed as LivewireInitialData;
    }

    if (parsed && "memo" in parsed && "checksum" in parsed) {
      return buildInitialDataFromSnapshot(parsed as LivewireSnapshot);
    }

    throw new Error("Invalid Livewire snapshot payload.");
  }

  if (raw && typeof raw === "object") {
    const parsed = raw as Record<string, unknown>;
    if ("fingerprint" in parsed && "serverMemo" in parsed) {
      return parsed as LivewireInitialData;
    }

    if ("memo" in parsed && "checksum" in parsed) {
      return buildInitialDataFromSnapshot(parsed as LivewireSnapshot);
    }
  }

  throw new Error("Invalid Livewire snapshot payload.");
}

function parseLivewireInitialData(
  html: string,
  componentName: string
): LivewireParseResult {
  const $ = cheerio.load(html);
  const csrfToken = $("meta[name='csrf-token']").attr("content")?.trim() || null;

  const initialNodes = $("[wire\\:initial-data]").toArray();
  for (const node of initialNodes) {
    const raw = $(node).attr("wire:initial-data");
    if (!raw) {
      continue;
    }

    const decoded = decodeHtmlAttribute(raw);
    const parsed = JSON.parse(decoded) as LivewireInitialData;
    const fingerprintName = parsed.fingerprint?.["name"];
    if (!componentName || fingerprintName === componentName) {
      return { initialData: parsed, csrfToken };
    }
  }

  const snapshotNodes = $("[wire\\:snapshot]").toArray();
  for (const node of snapshotNodes) {
    const raw = $(node).attr("wire:snapshot");
    if (!raw) {
      continue;
    }

    const decoded = decodeHtmlAttribute(raw);
    const snapshot = JSON.parse(decoded) as LivewireSnapshot;
    const memoName = snapshot.memo?.["name"] as string | undefined;
    if (componentName && memoName !== componentName) {
      continue;
    }

    return { initialData: buildInitialDataFromSnapshot(snapshot), csrfToken };
  }

  throw new Error("Livewire component snapshot not found on page.");
}

function createUpdateId() {
  return Math.random().toString(36).slice(2, 6);
}

function resolveSampleImageUrl(pageUrl: string, urlOverride?: string) {
  const raw =
    urlOverride?.trim() ||
    process.env.SAMPLE_IMAGE_URL?.trim() ||
    "/sample.jpg";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return new URL(raw, pageUrl).toString();
}

export async function POST(request: Request) {
  const targetUrl = process.env.TARGET_API_URL;
  if (!targetUrl) {
    return Response.json(
      { error: "TARGET_API_URL is not set." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form payload." }, { status: 400 });
  }

  const title = formData.get("title");
  const content = formData.get("content");
  const image = formData.get("image");
  const sourceUrl = formData.get("source_url");
  const article = formData.get("article");
  const thumbnailUrl = formData.get("thumbnail_url");
  const videoId = formData.get("video_id");
  const livewireCookieInput = formData.get("livewire_cookie");
  const csrfTokenInput = formData.get("csrf_token");
  const sampleImageUrlInput = formData.get("sample_image_url");

  if (typeof title !== "string" || typeof content !== "string") {
    return Response.json({ error: "Missing title or content." }, { status: 400 });
  }

  if (typeof sourceUrl !== "string") {
    return Response.json({ error: "Missing source_url." }, { status: 400 });
  }

  if (!isLivewireTarget(targetUrl)) {
    if (!(image instanceof File)) {
      return Response.json({ error: "Missing image file." }, { status: 400 });
    }

    const forwardData = new FormData();
    forwardData.append("title", title);
    forwardData.append("content", content);
    forwardData.append("image", image, image.name);
    forwardData.append("source_url", sourceUrl);

    const response = await fetch(targetUrl, {
      method: "POST",
      body: forwardData,
    });

    const bodyText = await response.text();

    return Response.json({
      ok: response.ok,
      status: response.status,
      body: bodyText,
    });
  }

  if (typeof thumbnailUrl !== "string") {
    return Response.json(
      { error: "Missing thumbnail_url for Livewire publish." },
      { status: 400 }
    );
  }

  const articleText = typeof article === "string" ? article : "";
  const livewirePageUrl =
    process.env.LIVEWIRE_PAGE_URL?.trim() || DEFAULT_LIVEWIRE_PAGE_URL;
  const livewireComponent =
    process.env.LIVEWIRE_COMPONENT_NAME?.trim() || DEFAULT_LIVEWIRE_COMPONENT;
  const livewireCookie =
    typeof livewireCookieInput === "string" && livewireCookieInput.trim()
      ? livewireCookieInput.trim()
      : process.env.LIVEWIRE_COOKIE?.trim();
  const csrfTokenOverride =
    typeof csrfTokenInput === "string" && csrfTokenInput.trim()
      ? csrfTokenInput.trim()
      : null;
const livewireSnapshotOverride = LIVEWIRE_SNAPSHOT_OVERRIDE;
  const sampleImageUrl = resolveSampleImageUrl(
    livewirePageUrl,
    typeof sampleImageUrlInput === "string" ? sampleImageUrlInput : undefined
  );
  const headerImageUrl = thumbnailUrl.trim() ? thumbnailUrl : sampleImageUrl;
  const descriptionHtml = buildRichHtml({
    headerImageUrl,
    thumbnailUrl,
    article: articleText,
    platform: "youtube",
    originalUrl: sourceUrl,
    youtubeVideoId:
      typeof videoId === "string" && videoId.trim() ? videoId.trim() : undefined,
  });

  try {
    let initialData: LivewireInitialData | null = null;
    let csrfToken: string | null = null;

    if (livewireSnapshotOverride) {
      try {
        initialData = parseLivewireOverride(livewireSnapshotOverride);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Invalid Livewire snapshot payload.";
        return Response.json({ error: message }, { status: 400 });
      }
    } else {
      const pageResponse = await fetch(livewirePageUrl, {
        headers: {
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "User-Agent":
            process.env.LIVEWIRE_USER_AGENT?.trim() ||
            DEFAULT_LIVEWIRE_USER_AGENT,
          ...(livewireCookie ? { Cookie: livewireCookie } : {}),
        },
      });

      if (!pageResponse.ok) {
        return Response.json(
          { error: `Failed to load Livewire page: ${pageResponse.status}` },
          { status: 500 }
        );
      }

      const html = await pageResponse.text();
      const parsed = parseLivewireInitialData(html, livewireComponent);
      initialData = parsed.initialData;
      csrfToken = parsed.csrfToken;
    }

    if (!initialData) {
      return Response.json(
        { error: "Livewire snapshot missing after fetch." },
        { status: 500 }
      );
    }

    const resolvedInitialData = initialData;
    const effectiveCsrfToken = csrfTokenOverride ?? csrfToken;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-Livewire": "true",
      Referer: livewirePageUrl,
    };

    if (effectiveCsrfToken) {
      headers["X-CSRF-TOKEN"] = effectiveCsrfToken;
    }

    if (livewireCookie) {
      headers.Cookie = livewireCookie;
    }

    const updates = [
      {
        type: "syncInput",
        payload: { id: createUpdateId(), name: "title", value: title },
      },
      ...(thumbnailUrl.trim()
        ? [
            {
              type: "syncInput",
              payload: {
                id: createUpdateId(),
                name: "image",
                value: thumbnailUrl,
              },
            },
          ]
        : []),
      {
        type: "callMethod",
        payload: {
          id: createUpdateId(),
          method: "$set",
          params: ["description", descriptionHtml],
        },
      },
    ];

    const updatePayload = {
      fingerprint: resolvedInitialData.fingerprint,
      serverMemo: resolvedInitialData.serverMemo,
      updates,
    };

    const updateResponse = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(updatePayload),
    });

    const updateBodyText = await updateResponse.text();
    let updateJson: Record<string, unknown> | null = null;
    try {
      updateJson = JSON.parse(updateBodyText) as Record<string, unknown>;
    } catch {
      updateJson = null;
    }

    const updateServerMemo =
      updateJson && isPlainObject(updateJson.serverMemo)
        ? updateJson.serverMemo
        : null;

    if (!updateResponse.ok || !updateServerMemo) {
      return Response.json(
        {
          error: "Livewire update failed.",
          status: updateResponse.status,
          body: updateBodyText,
        },
        { status: 500 }
      );
    }

    const mergedServerMemo = mergeServerMemo(
      resolvedInitialData.serverMemo,
      updateServerMemo
    );

    const savePayload = {
      fingerprint: resolvedInitialData.fingerprint,
      serverMemo: mergedServerMemo,
      updates: [
        {
          type: "callMethod",
          payload: { id: createUpdateId(), method: "save", params: [] },
        },
      ],
    };

    const saveResponse = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(savePayload),
    });

    const saveBodyText = await saveResponse.text();

    return Response.json({
      ok: saveResponse.ok,
      updateStatus: updateResponse.status,
      saveStatus: saveResponse.status,
      saveBody: saveBodyText,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Livewire publish failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
