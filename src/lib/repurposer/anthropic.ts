import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local locally, or to the Vercel project's environment variables in production.",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export const MODEL = "claude-sonnet-4-6";
