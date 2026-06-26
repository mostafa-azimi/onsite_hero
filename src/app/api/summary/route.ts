import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WorkflowEntry = {
  name?: string;
  status?: string;
  severity?: string;
  rootCause?: string;
  notes?: string;
  nextStep?: string;
};

type SummaryInput = {
  accountName?: string;
  accountId?: string;
  arr?: string;
  location?: string;
  visitDate?: string;
  visitObjective?: string;
  facilityProfile?: string;
  ordersPerDay?: string;
  skuCount?: string;
  shifts?: string;
  integrations?: string;
  painPoints?: string;
  trainingGaps?: string;
  blockers?: string;
  recommendations?: string;
  customerSentiment?: string;
  followUpOwner?: string;
  followUpDate?: string;
  generalNotes?: string;
  transcript?: string;
  trendTags?: string[];
  workflows?: WorkflowEntry[];
};

function compact(value?: string) {
  return value?.trim() || "Not captured";
}

function localSummary(input: SummaryInput) {
  const workflows = input.workflows || [];
  const reviewed = workflows.filter(
    (workflow) => workflow.status && workflow.status !== "Not reviewed",
  );
  const risks = workflows.filter(
    (workflow) =>
      workflow.status === "Issue found" || workflow.status === "Follow-up",
  );
  const tags = [
    ...(input.trendTags || []),
    ...workflows
      .map((workflow) => workflow.rootCause)
      .filter((rootCause): rootCause is string => Boolean(rootCause)),
  ];

  return [
    `Account: ${compact(input.accountName)} (${compact(input.accountId)})`,
    `Location/date: ${compact(input.location)} on ${compact(input.visitDate)}.`,
    `Commercial context: ARR ${compact(input.arr)}; sentiment ${compact(
      input.customerSentiment,
    )}.`,
    `Visit objective: ${compact(input.visitObjective)}.`,
    `Operation snapshot: ${compact(input.facilityProfile)}; ${compact(
      input.ordersPerDay,
    )} orders/day; ${compact(input.skuCount)} SKUs; ${compact(input.shifts)} shifts.`,
    `Workflows covered: ${
      reviewed.length > 0
        ? reviewed
            .map((workflow) => `${workflow.name} (${workflow.status})`)
            .join(", ")
        : "None marked"
    }.`,
    `Open risks: ${
      risks.length > 0
        ? risks
            .map(
              (workflow) =>
                `${workflow.name} - ${workflow.severity || "No severity"}${
                  workflow.nextStep ? `; next step: ${workflow.nextStep}` : ""
                }`,
            )
            .join(" | ")
        : "No issue workflows marked"
    }.`,
    `Themes: ${tags.length > 0 ? [...new Set(tags)].join(", ") : "None tagged"}.`,
    `Blockers: ${compact(input.blockers)}.`,
    `Recommendations: ${compact(input.recommendations)}.`,
    `Follow-up: ${compact(input.followUpOwner)} by ${compact(input.followUpDate)}.`,
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
        "You summarize ShipHero WMS customer onsite visits. Produce a concise operational closeout with sections: Situation, Workflows Covered, Issues and Root Causes, Customer Impact, Recommendations, Follow-up Owners, Trend Tags. Use only the provided visit data.",
      input: JSON.stringify(input),
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({
      source: "local",
      summary: fallback,
      error: "OpenAI summary request failed, so a local draft was returned.",
    });
  }

  const payload = (await response.json()) as unknown;
  const summary = extractOutputText(payload) || fallback;

  return NextResponse.json({
    source: "openai",
    summary,
  });
}
