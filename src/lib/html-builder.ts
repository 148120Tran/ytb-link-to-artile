export type RichHtmlParams = {
  headerImageUrl?: string | null;
  thumbnailUrl?: string | null;
  article: string;
  platform: "youtube" | "tiktok" | "generic";
  originalUrl: string;
  videoId?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitParagraphs(article: string) {
  const normalized = article.replace(/\r\n/g, "\n");
  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function buildRichHtml({
  headerImageUrl,
  thumbnailUrl,
  article,
  platform,
  originalUrl,
  videoId,
}: RichHtmlParams) {
  const normalizedHeaderImageUrl = headerImageUrl?.trim() || "";
  const normalizedThumbnailUrl = thumbnailUrl?.trim() || "";
  const resolvedHeaderImageUrl =
    normalizedHeaderImageUrl || "/sample.jpg";
  const isDuplicateImage =
    Boolean(normalizedThumbnailUrl) &&
    resolvedHeaderImageUrl === normalizedThumbnailUrl;
  const headerHtml = `<div style="text-align:center"><img src="${resolvedHeaderImageUrl}" width="1920" style="max-width:100%" /></div>`;

  const shouldShowThumbnail =
    Boolean(normalizedThumbnailUrl) && !isDuplicateImage;
  const thumbnailContent = shouldShowThumbnail
    ? `<img src="${normalizedThumbnailUrl}" width="1920" style="max-width:100%;height:auto" />`
    : platform === "generic"
      ? `<a href="${originalUrl}" target="_blank" rel="noopener noreferrer">Open source</a>`
      : "";
  const thumbnailHtml = thumbnailContent
    ? `<div style="text-align:center;margin:24px 0">${thumbnailContent}</div>`
    : "";
  const introHtml =
    '<p><strong>Watch the full video at the end.</strong></p>';

  const paragraphs = splitParagraphs(article)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const articleHtml = `<div>${paragraphs}</div>`;
  const outroHtml = '<p><strong>Full video.</strong></p>';

  let footerHtml = "";
  const normalizedVideoId = videoId?.trim() || "";

  if (platform === "youtube" && normalizedVideoId) {
    footerHtml = `<div style="text-align:center;margin-top:32px"><iframe width="560" height="315" src="https://www.youtube.com/embed/${normalizedVideoId}" title="YouTube video" frameborder="0" allowfullscreen></iframe></div>`;
  } else if (platform === "tiktok" && normalizedVideoId) {
    footerHtml = `<div style="text-align:center;margin-top:32px"><iframe width="325" height="575" src="https://www.tiktok.com/embed/v2/${normalizedVideoId}" title="TikTok video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width:100%;border:none"></iframe></div>`;
  } else if (platform === "generic" || platform === "tiktok") {
    const footerContent = thumbnailUrl
      ? `<a href="${originalUrl}" target="_blank" rel="noopener noreferrer"><img src="${thumbnailUrl}" width="1920" style="max-width:100%;height:auto" /></a>`
      : `<a href="${originalUrl}" target="_blank" rel="noopener noreferrer">Open source</a>`;
    footerHtml = `<div style="text-align:center;margin-top:32px">${footerContent}</div>`;
  }

  const bodyParts = [headerHtml, thumbnailHtml, introHtml, articleHtml].filter(
    Boolean
  );
  if (footerHtml) {
    bodyParts.push(outroHtml, footerHtml);
  } else {
    bodyParts.push(outroHtml);
  }

  return bodyParts.join("");
}
