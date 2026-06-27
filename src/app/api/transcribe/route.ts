import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Set OPENAI_API_KEY to enable AI transcription.",
      },
      { status: 400 },
    );
  }

  const incomingForm = await request.formData();
  const file = incomingForm.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A recorded audio file is required." },
      { status: 400 },
    );
  }

  const openAiForm = new FormData();
  openAiForm.append("file", file, file.name || "onsite-audio.webm");
  openAiForm.append("model", model);
  openAiForm.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: openAiForm,
  });

  const payload = (await response.json()) as { text?: string; error?: unknown };

  if (!response.ok || !payload.text) {
    return NextResponse.json(
      {
        error:
          typeof payload.error === "string"
            ? payload.error
            : "OpenAI transcription failed.",
      },
      { status: response.status || 500 },
    );
  }

  return NextResponse.json({ text: payload.text });
}
