import * as cheerio from "cheerio";

export type OpenGraphMeta = {
  title?: string;
  description?: string;
  image?: string;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
};

export async function getOpenGraphMeta(url: string): Promise<OpenGraphMeta> {
  const response = await fetch(url, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    throw new Error(`OpenGraph request failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const readMeta = (key: string) =>
    $(`meta[property='${key}']`).attr("content") ||
    $(`meta[name='${key}']`).attr("content");

  const title = readMeta("og:title") || $("title").first().text();
  const description =
    readMeta("og:description") ||
    $("meta[name='description']").attr("content") ||
    "";
  const image = readMeta("og:image") || "";

  return {
    title: title?.trim() || undefined,
    description: description?.trim() || undefined,
    image: image?.trim() || undefined,
  };
}
