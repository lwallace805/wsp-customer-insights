import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, MODEL } from "@/lib/repurposer/anthropic";
import { SYSTEM_PROMPT } from "@/lib/repurposer/prompts";
import { ContentPackSchema, CONTENT_PACK_TOOL_SCHEMA } from "@/lib/repurposer/schema";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "Transcript is required." },
      { status: 400 },
    );
  }

  if (transcript.length < 200) {
    return NextResponse.json(
      { error: "Transcript looks too short. Paste at least a few paragraphs." },
      { status: 400 },
    );
  }

  if (transcript.length > 400_000) {
    return NextResponse.json(
      { error: "Transcript is too long. Trim to under ~400k characters." },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  console.log(
    `[/api/repurpose] start: transcript_chars=${transcript.length}`,
  );

  try {
    const response = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "return_content_pack",
          description:
            "Return the full repurposed content pack for the webinar. Call this exactly once.",
          input_schema: CONTENT_PACK_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "return_content_pack" },
      messages: [
        {
          role: "user",
          content: `Here is the webinar transcript. Generate the full content pack now by calling the return_content_pack tool.\n\n<transcript>\n${transcript}\n</transcript>`,
        },
      ],
    });

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[/api/repurpose] model done: stop_reason=${response.stop_reason} elapsed_ms=${elapsedMs} input=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} output=${response.usage.output_tokens}`,
    );

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error(
        `[/api/repurpose] no tool_use in response. stop_reason=${response.stop_reason}`,
      );
      const hint =
        response.stop_reason === "max_tokens"
          ? " The model hit the token limit before finishing — try a shorter transcript."
          : "";
      return NextResponse.json(
        { error: `Model did not return structured output.${hint}` },
        { status: 502 },
      );
    }

    if (response.stop_reason === "max_tokens") {
      console.error(
        "[/api/repurpose] tool_use present but stop_reason=max_tokens — output may be truncated",
      );
      return NextResponse.json(
        {
          error:
            "Model output was truncated at the token limit. Try a shorter transcript.",
        },
        { status: 502 },
      );
    }

    const parsed = ContentPackSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      console.error(
        "[/api/repurpose] schema validation failed",
        parsed.error.flatten(),
      );
      return NextResponse.json(
        {
          error: "Model output failed validation.",
          details: parsed.error.flatten(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      contentPack: parsed.data,
      usage: response.usage,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error(
      `[/api/repurpose] error after ${elapsedMs}ms:`,
      err,
    );
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 },
    );
  }
}
