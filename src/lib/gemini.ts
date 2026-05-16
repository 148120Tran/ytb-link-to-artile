import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_ARTICLE_PROMPT } from "./prompts";

const DEFAULT_MODEL = "gemini-1.5-flash-latest";

export async function generateArticle(content: string, customPrompt?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const trimmedContent = content?.trim();
  if (!trimmedContent) {
    throw new Error("Content is empty.");
  }

  const prompt = customPrompt?.trim() || DEFAULT_ARTICLE_PROMPT;
  const rawModelName = process.env.GEMINI_MODEL?.trim();
  const modelName = rawModelName
    ? rawModelName.replace(/^models\//, "")
    : DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent([
    `${prompt}\n\nCONTENT:\n${trimmedContent}`,
  ]);

  return result.response.text().trim();
}
