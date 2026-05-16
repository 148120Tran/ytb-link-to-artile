"use client";

import { useEffect, useMemo, useState } from "react";
import PreviewPanel from "./components/PreviewPanel";
import { buildRichHtml } from "@/lib/html-builder";
import { DEFAULT_ARTICLE_PROMPT } from "@/lib/prompts";

type ExtractResponse = {
  title: string;
  thumbnailUrl: string;
  content: string;
  platform: "youtube" | "generic";
  originalUrl: string;
  transcriptAvailable: boolean;
  videoId?: string;
};

type Status =
  | "idle"
  | "extracting"
  | "generating"
  | "preview"
  | "publishing"
  | "done";

const FALLBACK_HEADER_IMAGE_URL = "/sample.jpg";

const STATUS_COPY: Record<Status, string> = {
  idle: "Ready",
  extracting: "Extracting metadata",
  generating: "Generating article",
  preview: "Ready to edit",
  publishing: "Publishing",
  done: "Published",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState(
    FALLBACK_HEADER_IMAGE_URL
  );
  const [livewireCookie, setLivewireCookie] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [extractData, setExtractData] = useState<ExtractResponse | null>(null);
  const [article, setArticle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    return () => {
      if (headerPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(headerPreviewUrl);
      }
    };
  }, [headerPreviewUrl]);

  const previewHtml = useMemo(() => {
    if (!extractData || !article.trim()) {
      return "";
    }

    return buildRichHtml({
      headerImageUrl: headerPreviewUrl,
      thumbnailUrl: extractData.thumbnailUrl,
      article,
      platform: extractData.platform,
      originalUrl: extractData.originalUrl,
      youtubeVideoId: extractData.videoId,
    });
  }, [article, extractData, headerPreviewUrl]);

  const handleHeaderChange = (file: File | null) => {
    if (headerPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(headerPreviewUrl);
    }

    if (file) {
      setHeaderFile(file);
      setHeaderPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setHeaderFile(null);
    setHeaderPreviewUrl(FALLBACK_HEADER_IMAGE_URL);
  };

  const resolvePublishImageFile = async () => {
    if (headerFile) {
      return headerFile;
    }

    const response = await fetch(FALLBACK_HEADER_IMAGE_URL);
    if (!response.ok) {
      throw new Error(
        "Missing sample.jpg. Add it to /public or upload a header image file."
      );
    }

    const blob = await response.blob();
    const name = FALLBACK_HEADER_IMAGE_URL.split("/").pop() || "sample.jpg";
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  };

  const handleGenerate = async () => {
    setError(null);
    setWarning(null);

    if (!url.trim()) {
      setError("Paste a YouTube link first.");
      return;
    }

    try {
      setStatus("extracting");
      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const extractJson = (await extractResponse.json()) as
        | ExtractResponse
        | { error: string };

      if (!extractResponse.ok) {
        throw new Error(
          "error" in extractJson ? extractJson.error : "Extraction failed."
        );
      }

      setExtractData(extractJson);

      if (!extractJson.transcriptAvailable) {
        setWarning(
          "Transcript unavailable. Using title and description as fallback."
        );
      }

      setStatus("generating");
      setCooldownSeconds(4);

      const generateResponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: extractJson.content,
          customPrompt: customPrompt.trim() ? customPrompt : undefined,
        }),
      });

      const generateJson = (await generateResponse.json()) as
        | { article: string }
        | { error: string };

      if (!generateResponse.ok) {
        throw new Error(
          "error" in generateJson ? generateJson.error : "Generation failed."
        );
      }

      setArticle(generateJson.article);
      setStatus("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something failed.";
      setError(message);
      setStatus("idle");
    }
  };

  const handlePublish = async () => {
    setError(null);

    if (!extractData) {
      setError("Generate an article first.");
      return;
    }

    try {
      setStatus("publishing");

      const htmlForPublish = buildRichHtml({
        headerImageUrl: headerFile ? "/header.png" : FALLBACK_HEADER_IMAGE_URL,
        thumbnailUrl: extractData.thumbnailUrl,
        article,
        platform: extractData.platform,
        originalUrl: extractData.originalUrl,
        youtubeVideoId: extractData.videoId,
      });

      const publishImageFile = await resolvePublishImageFile();

      const formData = new FormData();
      formData.append("title", extractData.title);
      formData.append("content", htmlForPublish);
      formData.append("article", article);
      if (extractData.thumbnailUrl) {
        formData.append("thumbnail_url", extractData.thumbnailUrl);
      }
      if (extractData.videoId) {
        formData.append("video_id", extractData.videoId);
      }
      if (livewireCookie.trim()) {
        formData.append("livewire_cookie", livewireCookie.trim());
      }
      if (csrfToken.trim()) {
        formData.append("csrf_token", csrfToken.trim());
      }
      formData.append("image", publishImageFile, publishImageFile.name);
      formData.append("source_url", extractData.originalUrl);

      const response = await fetch("/api/publish", {
        method: "POST",
        body: formData,
      });

      const responseJson = (await response.json()) as
        | { ok: boolean; status: number; body: string }
        | { error: string };

      if (!response.ok || ("ok" in responseJson && !responseJson.ok)) {
        throw new Error(
          "error" in responseJson
            ? responseJson.error
            : "Publish failed."
        );
      }

      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed.";
      setError(message);
      setStatus("preview");
    }
  };

  const isGenerateDisabled =
    status === "extracting" ||
    status === "generating" ||
    cooldownSeconds > 0 ||
    !url.trim();

  const isPublishDisabled = status === "publishing" || !article.trim();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#1f2a44,_#0b0f1a_60%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(244,178,102,0.35),transparent_65%)] blur-3xl" />
        <div className="absolute right-[-6rem] top-[18%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,_rgba(90,123,216,0.35),transparent_65%)] blur-3xl" />
        <div className="absolute left-[-10rem] bottom-[-8rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(120,88,189,0.3),transparent_70%)] blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-6 animate-fade-up">
          <span className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/70">
            ytb link-to-article
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Turn a YouTube link into an article-ready HTML package.
            </h1>
            <p className="max-w-2xl text-lg text-white/70">
              Extract metadata, pull the transcript, generate a neutral article,
              and assemble the rich HTML ready to post.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Status: {STATUS_COPY[status]}
            </div>
            {cooldownSeconds > 0 && (
              <div className="rounded-full border border-amber-300/30 bg-amber-200/10 px-4 py-2 text-amber-100">
                Gemini cooldown {cooldownSeconds}s
              </div>
            )}
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.45)]">
              <div className="flex flex-col gap-5">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                    YouTube link
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 text-base text-white outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowPrompt((value) => !value)}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition hover:border-white/30"
                >
                  Custom prompt
                  <span className="text-xs text-white/50">
                    {showPrompt ? "Hide" : "Show"}
                  </span>
                </button>

                {showPrompt && (
                  <textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    placeholder={DEFAULT_ARTICLE_PROMPT}
                    className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white/80 outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                )}

                <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Header image file
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleHeaderChange(event.target.files?.[0] || null)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-amber-200/20 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-amber-100"
                    />
                    <p className="text-xs text-white/50">
                      If no file is uploaded default is used in the HTML
                      and sent on publish.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <img
                      src={headerPreviewUrl}
                      alt="Header preview"
                      className="h-36 w-full rounded-xl object-cover"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Livewire cookie (optional)
                  </label>
                  <textarea
                    value={livewireCookie}
                    onChange={(event) => setLivewireCookie(event.target.value)}
                    placeholder="Paste your authenticated cookie here to publish"
                    className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-xs text-white/80 outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                  <p className="text-xs text-white/50">
                    Required for authenticated Livewire endpoints. Leave empty
                    to use the server-side LIVEWIRE_COOKIE env.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-white/60">
                    CSRF token (optional)
                  </label>
                  <input
                    type="text"
                    value={csrfToken}
                    onChange={(event) => setCsrfToken(event.target.value)}
                    placeholder="Paste X-CSRF-TOKEN from the browser"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 text-xs text-white/80 outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                  <p className="text-xs text-white/50">
                    Override the parsed token if it expires or the page blocks
                    scraping.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="rounded-full bg-amber-200/90 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
                  >
                    {status === "generating" || status === "extracting"
                      ? "Working..."
                      : "Generate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("");
                      setCustomPrompt("");
                      setExtractData(null);
                      setArticle("");
                      setError(null);
                      setWarning(null);
                      setStatus("idle");
                    }}
                    className="rounded-full border border-white/20 px-6 py-3 text-sm text-white/70 transition hover:border-white/40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {(error || warning) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm">
                {error && (
                  <p className="text-rose-200">Error: {error}</p>
                )}
                {warning && (
                  <p className="text-amber-100">{warning}</p>
                )}
              </div>
            )}

            {extractData && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-col gap-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Extracted metadata
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
                      {extractData.thumbnailUrl ? (
                        <img
                          src={extractData.thumbnailUrl}
                          alt="Thumbnail"
                          className="h-40 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center text-sm text-white/50">
                          No thumbnail
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">
                        {extractData.title}
                      </h3>
                      <p className="text-sm text-white/60">
                        Platform: {extractData.platform}
                      </p>
                      <p className="text-sm text-white/60">
                        Transcript: {extractData.transcriptAvailable ? "Yes" : "No"}
                      </p>
                      <a
                        href={extractData.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-amber-200 hover:text-amber-100"
                      >
                        Open source link
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {article && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-col gap-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Editable article
                  </div>
                  <textarea
                    value={article}
                    onChange={(event) => setArticle(event.target.value)}
                    className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white/80 outline-none transition focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={isPublishDisabled}
                      className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/40"
                    >
                      {status === "publishing" ? "Publishing..." : "Publish"}
                    </button>
                    {status === "done" && (
                      <span className="text-sm text-emerald-200">
                        Published to mock endpoint.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <PreviewPanel html={previewHtml} />

            {article && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Rich HTML summary
                </div>
                <p className="mt-3">
                  Header image: /header.png, thumbnail: {extractData?.thumbnailUrl ? "ready" : "missing"},
                  embed: {extractData?.platform === "youtube" ? "iframe" : "link"}.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
