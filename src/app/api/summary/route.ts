import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WorkflowFinding = {
  workflow?: string;
  status?: string;
  evidence?: string;
  severity?: string;
  rootCause?: string;
  nextStep?: string;
};

type OrganizedVisit = {
  account?: {
    customerName?: string;
    customerId?: string;
    location?: string;
    visitObjective?: string;
    visitDate?: string;
  };
  overview?: string;
  workflows?: WorkflowFinding[];
  issues?: string[];
  trainingGaps?: string[];
  recommendations?: string[];
  followUps?: string[];
  trendTags?: string[];
  sentiment?: string;
  missingInfo?: string[];
};

type SummaryInput = {
  customerName?: string;
  customerId?: string;
  location?: string;
  visitObjective?: string;
  overview?: string;
  additionalContext?: string;
  organized?: OrganizedVisit | null;
};

function compact(value?: string) {
  return value?.trim() || "Not captured";
}

function list(values?: string[]) {
  return values && values.length > 0 ? values.join("; ") : "Not captured";
}

function localSummary(input: SummaryInput) {
  const organized = input.organized;
  const account = organized?.account;
  const workflows =
    organized?.workflows && organized.workflows.length > 0
      ? organized.workflows
          .map(
            (workflow) =>
              `${compact(workflow.workflow)} (${compact(workflow.status)}): ${compact(
                workflow.evidence,
              )}`,
          )
          .join("; ")
      : "Not captured";

  return [
    `Customer: ${compact(account?.customerName || input.customerName)} (${compact(
      account?.customerId || input.customerId,
    )})`,
    `Location: ${compact(account?.location || input.location)}`,
    `Objective: ${compact(account?.visitObjective || input.visitObjective)}`,
    `Situation: ${compact(organized?.overview || input.overview)}`,
    `Workflows covered: ${workflows}`,
    `Issues and risks: ${list(organized?.issues)}`,
    `Training gaps: ${list(organized?.trainingGaps)}`,
    `Recommendations: ${list(organized?.recommendations)}`,
    `Follow-up: ${list(organized?.followUps)}`,
    `Trend tags: ${list(organized?.trendTags)}`,
    `Missing info: ${list(organized?.missingInfo)}`,
  ].join("\n");
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (!payload || typeof payload !== "object" || !("output" in payload)) {
    return "";
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        return [];
      }
      return content
        .map((part) => {
          if (part && typeof part === "object" && "text" in part) {
            return String(part.text || "");
          }
          return "";
        })
        .filter(Boolean);
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const input = (await request.json()) as SummaryInput;
  const fallback = localSummary(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUMMARY_MODEL;

  if (!apiKey || !model) {
    return NextResponse.json({
      source: "local",
      summary: fallback,
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        "You summarize ShipHero WMS onsite visits from an organized structured table. Produce a concise closeout with sections: Situation, Workflows Covered, Issues and Root Causes, Training/SOP Gaps, Recommendations, Follow-up, Trend Tags, Missing Info. Use only provided data.",
      input: JSON.stringify(input),
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({
      source: "local",
      summary: fallback,
      error: "OpenAI summary request failed, so a local summary was returned.",
    });
  }

  const payload = (await response.json()) as unknown;
  const summary = extractOutputText(payload) || fallback;

  return NextResponse.json({
    source: "openai",
    summary,
  });
}
