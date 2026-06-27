import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_TEXT_MODEL = "gpt-5.5";

type WorkflowFinding = {
  workflow: string;
  status: string;
  evidence: string;
  severity: string;
  rootCause: string;
  nextStep: string;
};

type OrganizedVisit = {
  account: {
    customerName: string;
    customerId: string;
    location: string;
    visitObjective: string;
    visitDate: string;
  };
  overview: string;
  workflows: WorkflowFinding[];
  issues: string[];
  trainingGaps: string[];
  recommendations: string[];
  followUps: string[];
  trendTags: string[];
  sentiment: string;
  missingInfo: string[];
};

type VisitDraft = {
  customerName?: string;
  customerId?: string;
  location?: string;
  visitObjective?: string;
  overview?: string;
  additionalContext?: string;
};

const workflowMap = [
  {
    workflow: "Receiving",
    terms: ["receiving", "asn", "inbound", "dock", "blind receive"],
  },
  {
    workflow: "Putaway",
    terms: ["putaway", "bin", "staging", "location assignment"],
  },
  {
    workflow: "Inventory",
    terms: ["inventory", "cycle count", "adjustment", "quarantine"],
  },
  {
    workflow: "Replenishment",
    terms: ["replenishment", "replenish", "forward pick", "min max"],
  },
  {
    workflow: "Picking",
    terms: ["picking", "pick", "batch", "cart", "tote", "wave"],
  },
  {
    workflow: "Packing",
    terms: ["packing", "pack", "pack station", "qc", "label reprint"],
  },
  {
    workflow: "Shipping",
    terms: ["shipping", "carrier", "manifest", "label", "pickup"],
  },
  {
    workflow: "Returns",
    terms: ["returns", "return", "rma", "restock", "disposition"],
  },
  {
    workflow: "Integrations",
    terms: ["integration", "shopify", "erp", "api", "carrier rules"],
  },
];

const issueTerms = [
  "issue",
  "problem",
  "blocked",
  "blocker",
  "risk",
  "broken",
  "confusing",
  "delay",
  "delays",
  "error",
  "errors",
  "stuck",
  "missing",
  "slow",
  "unclear",
];

const trainingTerms = ["train", "training", "coach", "coaching", "sop", "process"];
const followUpTerms = ["follow up", "next step", "owner", "due", "action item"];
const recommendationTerms = ["recommend", "should", "need to", "needs to", "suggest"];

function compact(value?: string) {
  return value?.trim() || "";
}

function sentenceMatches(sentence: string, terms: string[]) {
  const lower = sentence.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function inferSeverity(sentence: string) {
  const lower = sentence.toLowerCase();
  if (["down", "blocked", "stopped", "critical", "cannot", "at risk"].some((term) => lower.includes(term))) {
    return "High";
  }
  if (["delay", "slow", "error", "missing", "confusing", "unclear"].some((term) => lower.includes(term))) {
    return "Medium";
  }
  return "Low";
}

function inferRootCause(sentence: string) {
  const lower = sentence.toLowerCase();
  if (sentenceMatches(lower, ["training", "train", "unclear", "confusing"])) {
    return "Training";
  }
  if (sentenceMatches(lower, ["sop", "process", "procedure"])) {
    return "SOP gap";
  }
  if (sentenceMatches(lower, ["shopify", "erp", "api", "integration"])) {
    return "Integration";
  }
  if (sentenceMatches(lower, ["carrier", "label", "rule", "configuration", "config"])) {
    return "Configuration";
  }
  if (sentenceMatches(lower, ["scanner", "printer", "wifi", "network", "hardware"])) {
    return "Hardware or network";
  }
  return "Needs review";
}

function localOrganize(input: VisitDraft): OrganizedVisit {
  const overview = compact(input.overview);
  const additionalContext = compact(input.additionalContext);
  const combined = [overview, additionalContext].filter(Boolean).join("\n\n");
  const sentences = splitSentences(combined);

  const workflows = workflowMap
    .map((item) => {
      const evidence = sentences.filter((sentence) =>
        sentenceMatches(sentence, item.terms),
      );
      if (evidence.length === 0) {
        return null;
      }

      const issueEvidence = evidence.find((sentence) =>
        sentenceMatches(sentence, issueTerms),
      );
      const trained = evidence.some((sentence) =>
        sentenceMatches(sentence, trainingTerms),
      );
      const status = issueEvidence
        ? "Issue found"
        : trained
          ? "Trained"
          : "Observed";

      return {
        workflow: item.workflow,
        status,
        evidence: evidence.join(" "),
        severity: issueEvidence ? inferSeverity(issueEvidence) : "None",
        rootCause: issueEvidence ? inferRootCause(issueEvidence) : "",
        nextStep:
          evidence.find((sentence) => sentenceMatches(sentence, followUpTerms)) || "",
      };
    })
    .filter((item): item is WorkflowFinding => Boolean(item));

  const issues = unique(
    sentences.filter((sentence) => sentenceMatches(sentence, issueTerms)),
  );
  const trainingGaps = unique(
    sentences.filter((sentence) => sentenceMatches(sentence, trainingTerms)),
  );
  const recommendations = unique(
    sentences.filter((sentence) => sentenceMatches(sentence, recommendationTerms)),
  );
  const followUps = unique(
    sentences.filter((sentence) => sentenceMatches(sentence, followUpTerms)),
  );
  const trendTags = unique([
    ...workflows.map((item) => item.workflow),
    ...issues.map((item) => inferRootCause(item)),
    ...(trainingGaps.length > 0 ? ["Training needed"] : []),
    ...(followUps.length > 0 ? ["Support follow-up"] : []),
  ]);

  const missingInfo = validateVisit({
    account: {
      customerName: compact(input.customerName),
      customerId: compact(input.customerId),
      location: compact(input.location),
      visitObjective: compact(input.visitObjective),
      visitDate: new Date().toISOString().slice(0, 10),
    },
    overview,
    workflows,
    issues,
    trainingGaps,
    recommendations,
    followUps,
    trendTags,
    sentiment: issues.length > 0 ? "Needs attention" : "Neutral",
    missingInfo: [],
  });

  return {
    account: {
      customerName: compact(input.customerName),
      customerId: compact(input.customerId),
      location: compact(input.location),
      visitObjective: compact(input.visitObjective),
      visitDate: new Date().toISOString().slice(0, 10),
    },
    overview,
    workflows,
    issues,
    trainingGaps,
    recommendations,
    followUps,
    trendTags,
    sentiment: issues.length > 0 ? "Needs attention" : "Neutral",
    missingInfo,
  };
}

function validateVisit(visit: OrganizedVisit) {
  const missing: string[] = [];

  if (!visit.account.customerName) {
    missing.push("Customer name is required.");
  }
  if (!visit.account.customerId) {
    missing.push("Customer ID is required.");
  }
  if (!visit.account.location) {
    missing.push("Onsite location is required.");
  }
  if (!visit.account.visitObjective) {
    missing.push("Reason for the onsite visit is required.");
  }
  if (visit.overview.length < 80) {
    missing.push("Add a fuller onsite overview with what happened and why it matters.");
  }
  if (visit.workflows.length === 0) {
    missing.push("Mention at least one workflow reviewed, trained, or troubleshot.");
  }
  if (visit.issues.length === 0) {
    missing.push("State whether there were blockers or risks. If none, say none.");
  }
  if (visit.followUps.length === 0 && visit.recommendations.length === 0) {
    missing.push("Add the follow-up action, owner, recommendation, or say no follow-up needed.");
  }

  return missing;
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

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text) as Partial<OrganizedVisit>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    return JSON.parse(match[0]) as Partial<OrganizedVisit>;
  }
}

function normalizeVisit(input: VisitDraft, candidate: Partial<OrganizedVisit>) {
  const local = localOrganize(input);
  const visit: OrganizedVisit = {
    account: {
      ...local.account,
      ...(candidate.account || {}),
    },
    overview: compact(candidate.overview) || local.overview,
    workflows: Array.isArray(candidate.workflows)
      ? candidate.workflows.map((item) => ({
          workflow: compact(item.workflow),
          status: compact(item.status) || "Observed",
          evidence: compact(item.evidence),
          severity: compact(item.severity) || "None",
          rootCause: compact(item.rootCause),
          nextStep: compact(item.nextStep),
        }))
      : local.workflows,
    issues: Array.isArray(candidate.issues) ? candidate.issues.map(String) : local.issues,
    trainingGaps: Array.isArray(candidate.trainingGaps)
      ? candidate.trainingGaps.map(String)
      : local.trainingGaps,
    recommendations: Array.isArray(candidate.recommendations)
      ? candidate.recommendations.map(String)
      : local.recommendations,
    followUps: Array.isArray(candidate.followUps)
      ? candidate.followUps.map(String)
      : local.followUps,
    trendTags: Array.isArray(candidate.trendTags)
      ? candidate.trendTags.map(String)
      : local.trendTags,
    sentiment: compact(candidate.sentiment) || local.sentiment,
    missingInfo: [],
  };

  return {
    ...visit,
    missingInfo: validateVisit(visit),
  };
}

export async function POST(request: Request) {
  const input = (await request.json()) as VisitDraft;
  const fallback = localOrganize(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    process.env.OPENAI_ORGANIZE_MODEL ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.OPENAI_SUMMARY_MODEL ||
    DEFAULT_TEXT_MODEL;

  if (!apiKey) {
    return NextResponse.json({
      source: "local",
      organized: fallback,
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
        "You organize ShipHero WMS onsite visit notes. Return only valid JSON with keys account, overview, workflows, issues, trainingGaps, recommendations, followUps, trendTags, sentiment, missingInfo. workflows must be an array of objects with workflow, status, evidence, severity, rootCause, nextStep. Validate the visit and include missingInfo prompts when required info is thin or absent.",
      input: JSON.stringify(input),
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({
      source: "local",
      organized: fallback,
      error: "OpenAI organizer failed, so local parsing was used.",
    });
  }

  try {
    const payload = (await response.json()) as unknown;
    const text = extractOutputText(payload);
    const parsed = text ? parseJsonObject(text) : null;

    if (!parsed) {
      throw new Error("Model did not return JSON.");
    }

    return NextResponse.json({
      source: "openai",
      organized: normalizeVisit(input, parsed),
    });
  } catch {
    return NextResponse.json({
      source: "local",
      organized: fallback,
      error: "OpenAI organizer response could not be parsed, so local parsing was used.",
    });
  }
}
