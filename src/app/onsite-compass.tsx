"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "intro" | "required" | "overview" | "review";

type RequiredKey = "customerName" | "customerId" | "location" | "visitObjective";

type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

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
  customerName: string;
  customerId: string;
  location: string;
  visitObjective: string;
  overview: string;
  additionalContext: string;
  organized: OrganizedVisit | null;
  summary: string;
};

type SavedVisit = {
  id: string;
  savedAt: string;
  customerName: string;
  customerId: string;
  summary: string;
  tags: string[];
  missingInfo: string[];
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const DRAFT_KEY = "shiphero-onsite-conversation-draft";
const MESSAGES_KEY = "shiphero-onsite-conversation-messages";
const VISITS_KEY = "shiphero-onsite-conversation-visits";

const requiredQuestions: {
  key: RequiredKey;
  label: string;
  question: string;
  placeholder: string;
}[] = [
  {
    key: "customerName",
    label: "Customer name",
    question: "What is the customer name?",
    placeholder: "Example: Acme Fulfillment",
  },
  {
    key: "customerId",
    label: "Customer ID",
    question: "What is their customer ID?",
    placeholder: "Example: 12345 or SH-12345",
  },
  {
    key: "location",
    label: "Onsite location",
    question: "Where is this onsite happening?",
    placeholder: "Example: Las Vegas, NV warehouse",
  },
  {
    key: "visitObjective",
    label: "Reason for visit",
    question: "What is the main reason ShipHero is onsite?",
    placeholder: "Example: train pick/pack leads and troubleshoot shipping delays",
  },
];

const sectionRows = [
  {
    key: "account",
    label: "Account",
    prompt: "Customer name, customer ID, location, and visit objective.",
  },
  {
    key: "overview",
    label: "Overview",
    prompt: "What happened onsite in plain language.",
  },
  {
    key: "workflows",
    label: "Workflows",
    prompt: "Receiving, putaway, inventory, picking, packing, shipping, returns, integrations.",
  },
  {
    key: "issues",
    label: "Issues and risks",
    prompt: "Operational blockers, severity, customer impact, root causes.",
  },
  {
    key: "training",
    label: "Training gaps",
    prompt: "Where users need coaching, SOP changes, or reinforcement.",
  },
  {
    key: "followup",
    label: "Follow-up",
    prompt: "Owner, action, due date, and next customer touch.",
  },
];

const emptyDraft = (): VisitDraft => ({
  customerName: "",
  customerId: "",
  location: "",
  visitObjective: "",
  overview: "",
  additionalContext: "",
  organized: null,
  summary: "",
});

const starterMessages = (): ConversationMessage[] => [
  {
    id: crypto.randomUUID(),
    role: "assistant",
    text: "Press Start Visit and I will ask only the required setup questions. After that, give me the onsite story in your own words and I will organize it.",
  },
];

function readStoredDraft() {
  if (typeof window === "undefined") {
    return emptyDraft();
  }

  const stored = window.localStorage.getItem(DRAFT_KEY);
  if (!stored) {
    return emptyDraft();
  }

  try {
    return { ...emptyDraft(), ...(JSON.parse(stored) as Partial<VisitDraft>) };
  } catch {
    return emptyDraft();
  }
}

function readStoredMessages() {
  if (typeof window === "undefined") {
    return starterMessages();
  }

  const stored = window.localStorage.getItem(MESSAGES_KEY);
  if (!stored) {
    return starterMessages();
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ConversationMessage[]) : starterMessages();
  } catch {
    return starterMessages();
  }
}

function readStoredVisits() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(VISITS_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as SavedVisit[]) : [];
  } catch {
    return [];
  }
}

function hasSpeechSupport() {
  if (typeof window === "undefined") {
    return false;
  }

  const speechWindow = window as WindowWithSpeech;
  return Boolean(
    speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition,
  );
}

function requiredCount(draft: VisitDraft) {
  return requiredQuestions.filter((question) => draft[question.key].trim()).length;
}

function buildLocalSummary(draft: VisitDraft) {
  const organized = draft.organized;
  const workflows = organized?.workflows.map((item) => item.workflow).join(", ");
  const issues = organized?.issues.join("; ");
  const followUps = organized?.followUps.join("; ");

  return [
    `Customer: ${draft.customerName || "Not captured"} (${draft.customerId || "No ID"})`,
    `Location: ${draft.location || "Not captured"}`,
    `Objective: ${draft.visitObjective || "Not captured"}`,
    `Overview: ${organized?.overview || draft.overview || "Not captured"}`,
    `Workflows: ${workflows || "Not captured"}`,
    `Issues/Risks: ${issues || "Not captured"}`,
    `Follow-up: ${followUps || "Not captured"}`,
  ].join("\n");
}

function formatList(values: string[]) {
  if (values.length === 0) {
    return "Not captured yet";
  }

  return values.join("\n");
}

export default function OnsiteCompass() {
  const [phase, setPhase] = useState<Phase>(() => {
    const draft = readStoredDraft();
    if (draft.organized) {
      return "review";
    }
    if (draft.overview) {
      return "overview";
    }
    if (requiredCount(draft) > 0) {
      return "required";
    }
    return "intro";
  });
  const [questionIndex, setQuestionIndex] = useState(() => {
    const draft = readStoredDraft();
    const index = requiredQuestions.findIndex((question) => !draft[question.key]);
    return index === -1 ? requiredQuestions.length : index;
  });
  const [draft, setDraft] = useState<VisitDraft>(() => readStoredDraft());
  const [messages, setMessages] = useState<ConversationMessage[]>(() =>
    readStoredMessages(),
  );
  const [savedVisits, setSavedVisits] = useState<SavedVisit[]>(() =>
    readStoredVisits(),
  );
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported] = useState(() => hasSpeechSupport());
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(VISITS_KEY, JSON.stringify(savedVisits));
  }, [savedVisits]);

  const requiredProgress = requiredCount(draft);
  const completion = Math.round((requiredProgress / requiredQuestions.length) * 100);
  const organized = draft.organized;
  const missingInfo = organized?.missingInfo || [];
  const summary = draft.summary || buildLocalSummary(draft);
  const currentQuestion = requiredQuestions[questionIndex];

  const readiness = useMemo(() => {
    if (!organized) {
      return "Needs overview";
    }
    if (missingInfo.length > 0) {
      return "Needs follow-up";
    }
    return "Ready";
  }, [missingInfo.length, organized]);

  function addMessage(role: ConversationMessage["role"], text: string) {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role,
        text,
      },
    ]);
  }

  function startVisit() {
    const fresh = emptyDraft();
    setDraft(fresh);
    setQuestionIndex(0);
    setPhase("required");
    setAnswer("");
    setMessage("");
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: requiredQuestions[0].question,
      },
    ]);
  }

  async function submitAnswer() {
    const trimmed = answer.trim();
    if (!trimmed) {
      setMessage("Add an answer before continuing.");
      return;
    }

    setMessage("");
    addMessage("user", trimmed);
    setAnswer("");

    if (phase === "required" && currentQuestion) {
      const nextDraft = { ...draft, [currentQuestion.key]: trimmed };
      const nextIndex = questionIndex + 1;
      setDraft(nextDraft);
      setQuestionIndex(nextIndex);

      if (nextIndex < requiredQuestions.length) {
        addMessage("assistant", requiredQuestions[nextIndex].question);
        return;
      }

      setPhase("overview");
      addMessage(
        "assistant",
        "Great. Now give me the onsite overview naturally. Mention what workflows you saw, what felt broken or confusing, what training happened, and what follow-up is needed. I will organize it into the table.",
      );
      return;
    }

    if (phase === "overview") {
      const nextDraft = {
        ...draft,
        overview: [draft.overview, trimmed].filter(Boolean).join("\n\n"),
      };
      setDraft(nextDraft);
      await organizeVisit(nextDraft, "initial");
      return;
    }

    const nextDraft = {
      ...draft,
      additionalContext: [draft.additionalContext, trimmed]
        .filter(Boolean)
        .join("\n\n"),
    };
    setDraft(nextDraft);
    await organizeVisit(nextDraft, "followup");
  }

  async function organizeVisit(nextDraft: VisitDraft, mode: "initial" | "followup") {
    setIsOrganizing(true);
    setMessage("");

    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextDraft),
      });
      const result = (await response.json()) as {
        organized?: OrganizedVisit;
        source?: string;
        error?: string;
      };

      if (!response.ok || !result.organized) {
        throw new Error(result.error || "Could not organize this visit.");
      }

      const updatedDraft = { ...nextDraft, organized: result.organized, summary: "" };
      setDraft(updatedDraft);
      setPhase("review");

      if (result.organized.missingInfo.length > 0) {
        addMessage(
          "assistant",
          `I organized what you gave me, but I still need: ${result.organized.missingInfo.join(
            "; ",
          )}. Answer those in one message and I will update the table.`,
        );
      } else {
        addMessage(
          "assistant",
          mode === "initial"
            ? "I organized the visit and it satisfies the minimum requirements. You can save it, export it, or generate the final summary."
            : "I updated the table with your follow-up answer. The visit now satisfies the minimum requirements.",
        );
      }

      setMessage(
        result.source === "openai"
          ? "Organized with AI."
          : "Organized with local parsing. Add API keys later for stronger AI classification.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The visit could not be organized.",
      );
    } finally {
      setIsOrganizing(false);
    }
  }

  async function generateSummary() {
    if (!draft.organized) {
      setMessage("Add an overview first so there is something to summarize.");
      return;
    }

    setIsSummarizing(true);
    setMessage("");

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as {
        summary?: string;
        source?: string;
        error?: string;
      };

      if (!response.ok || !result.summary) {
        throw new Error(result.error || "Could not generate a summary.");
      }

      setDraft((current) => ({ ...current, summary: result.summary || "" }));
      setMessage(
        result.source === "openai"
          ? "AI summary generated."
          : "Summary generated locally. Add API keys later for model-written output.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The summary could not be generated.",
      );
    } finally {
      setIsSummarizing(false);
    }
  }

  function toggleDictation() {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const speechWindow = window as WindowWithSpeech;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setMessage("Browser dictation is not available here.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setAnswer((current) => [current, finalText].filter(Boolean).join(" "));
      }
      setInterimTranscript(interimText);
    };
    recognition.onerror = () => {
      setIsDictating(false);
      setMessage("Dictation stopped.");
    };
    recognition.onend = () => {
      setIsDictating(false);
      setInterimTranscript("");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    setMessage("Summary copied.");
  }

  function saveVisit() {
    const visit: SavedVisit = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      customerName: draft.customerName || "Unnamed customer",
      customerId: draft.customerId,
      summary,
      tags: draft.organized?.trendTags || [],
      missingInfo,
    };
    setSavedVisits((current) => [visit, ...current].slice(0, 10));
    setMessage("Visit saved locally.");
  }

  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            draft,
            summary,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.customerName || "onsite-visit"}-${
      new Date().toISOString().slice(0, 10)
    }.json`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetVisit() {
    const fresh = emptyDraft();
    setDraft(fresh);
    setPhase("intro");
    setQuestionIndex(0);
    setAnswer("");
    setMessage("Visit reset.");
    setMessages(starterMessages());
  }

  const tableRows = organized
    ? [
        {
          label: "Account",
          value: [
            organized.account.customerName,
            organized.account.customerId,
            organized.account.location,
            organized.account.visitObjective,
          ]
            .filter(Boolean)
            .join(" | "),
        },
        { label: "Overview", value: organized.overview || "Not captured yet" },
        {
          label: "Workflows",
          value:
            organized.workflows.length > 0
              ? organized.workflows
                  .map(
                    (item) =>
                      `${item.workflow}: ${item.status}. ${item.evidence}${
                        item.nextStep ? ` Next: ${item.nextStep}` : ""
                      }`,
                  )
                  .join("\n")
              : "Not captured yet",
        },
        { label: "Issues and risks", value: formatList(organized.issues) },
        { label: "Training gaps", value: formatList(organized.trainingGaps) },
        { label: "Recommendations", value: formatList(organized.recommendations) },
        { label: "Follow-up", value: formatList(organized.followUps) },
        { label: "Trend tags", value: formatList(organized.trendTags) },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#f4f6f2] text-[#17211d]">
      <section className="border-b border-[#d9ded6] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1f6f56]">
              ShipHero onsite compass
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
              Conversational onsite capture
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6e68]">
              Answer a few required questions, give the onsite story naturally,
              and the app organizes it into a structured visit table.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Required" value={`${completion}%`} />
            <Metric label="Readiness" value={readiness} />
            <Metric label="Saved" value={`${savedVisits.length}`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div className="space-y-5">
          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Interview</h2>
                <p className="mt-1 text-sm text-[#64736d]">
                  The app asks the minimum setup questions first, then switches
                  into freeform capture.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md bg-[#17211d] px-4 py-2 text-sm font-semibold text-white"
                  onClick={startVisit}
                  type="button"
                >
                  Start visit
                </button>
                <button
                  className="rounded-md border border-[#bdc8ba] bg-white px-4 py-2 text-sm font-semibold text-[#31423c]"
                  onClick={resetVisit}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {requiredQuestions.map((question) => (
                <div
                  className="border border-[#dce3d9] bg-[#fbfcfa] p-3"
                  key={question.key}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66756e]">
                    {question.label}
                  </p>
                  <p className="mt-2 min-h-10 text-sm font-medium">
                    {draft[question.key] || "Waiting"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 h-[380px] overflow-y-auto border border-[#dce3d9] bg-[#fbfcfa] p-3">
              <div className="space-y-3">
                {messages.map((item) => (
                  <div
                    className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-6 ${
                      item.role === "assistant"
                        ? "bg-white text-[#31423c]"
                        : "ml-auto bg-[#17211d] text-white"
                    }`}
                    key={item.id}
                  >
                    {item.text}
                  </div>
                ))}
                {isOrganizing ? (
                  <div className="max-w-[88%] rounded-md bg-white px-4 py-3 text-sm leading-6 text-[#31423c]">
                    Organizing the visit table...
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="text-sm font-medium">
                  {phase === "required" && currentQuestion
                    ? currentQuestion.question
                    : phase === "intro"
                      ? "Start the visit to begin"
                      : missingInfo.length > 0
                        ? "Answer the missing-info prompt"
                        : "Tell me what happened onsite"}
                </span>
                <textarea
                  className="mt-2 min-h-32 w-full resize-y rounded-md border border-[#cfd8cc] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#1f6f56] focus:ring-2 focus:ring-[#cfe1d9]"
                  disabled={phase === "intro" || isOrganizing}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      void submitAnswer();
                    }
                  }}
                  placeholder={
                    currentQuestion?.placeholder ||
                    "Example: We watched receiving and packing. Receiving was fine, but packing had label reprints and the team was unclear on exception handling..."
                  }
                  value={
                    interimTranscript
                      ? `${answer}\n\nListening: ${interimTranscript}`
                      : answer
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md bg-[#1f6f56] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#aab5af]"
                  disabled={phase === "intro" || isOrganizing}
                  onClick={() => void submitAnswer()}
                  type="button"
                >
                  {phase === "required" ? "Answer question" : "Organize answer"}
                </button>
                <button
                  className="rounded-md border border-[#bdc8ba] bg-white px-4 py-2 text-sm font-semibold text-[#31423c] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!speechSupported || phase === "intro"}
                  onClick={toggleDictation}
                  type="button"
                >
                  {isDictating ? "Stop dictation" : "Dictate"}
                </button>
                {message ? (
                  <p className="text-sm leading-6 text-[#53625c]">{message}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Organized table</h2>
                <p className="mt-1 text-sm leading-6 text-[#64736d]">
                  This is the structured output that can later feed AI summaries,
                  dashboards, and trend reporting.
                </p>
              </div>
              <span
                className={`w-fit rounded-md px-3 py-1 text-sm font-semibold ${
                  missingInfo.length > 0
                    ? "bg-[#fff6df] text-[#8a5400]"
                    : organized
                      ? "bg-[#e7f0eb] text-[#164f3f]"
                      : "bg-[#eef1ec] text-[#66756e]"
                }`}
              >
                {readiness}
              </span>
            </div>

            {organized ? (
              <div className="mt-5 overflow-hidden border border-[#dce3d9]">
                {tableRows.map((row) => (
                  <div
                    className="grid border-b border-[#dce3d9] last:border-b-0 md:grid-cols-[180px_1fr]"
                    key={row.label}
                  >
                    <div className="bg-[#f4f6f2] px-4 py-3 text-sm font-semibold">
                      {row.label}
                    </div>
                    <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-[#33423d]">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 border border-dashed border-[#bfc9bb] bg-[#fbfcfa] p-6 text-sm leading-6 text-[#5f6e68]">
                The organized table appears after the required questions and
                first onsite overview.
              </div>
            )}

            {missingInfo.length > 0 ? (
              <div className="mt-4 border border-[#f0d58f] bg-[#fff9e8] p-4">
                <p className="text-sm font-semibold text-[#735000]">
                  Needs more information
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#735000]">
                  {missingInfo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold">Summary</h2>
            <p className="mt-1 text-sm leading-6 text-[#64736d]">
              Generate after the table has enough information. Works locally
              now, and can use OpenAI once API keys are added.
            </p>
            <pre className="mt-4 min-h-72 whitespace-pre-wrap border border-[#dce3d9] bg-[#fbfcfa] p-4 text-sm leading-6 text-[#33423d]">
              {summary}
            </pre>
            <div className="mt-3 grid gap-2">
              <button
                className="rounded-md bg-[#17211d] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#aab5af]"
                disabled={!organized || isSummarizing}
                onClick={() => void generateSummary()}
                type="button"
              >
                {isSummarizing ? "Generating..." : "Generate summary"}
              </button>
              <button
                className="rounded-md border border-[#bdc8ba] bg-white px-4 py-2 text-sm font-semibold"
                onClick={() => void copySummary()}
                type="button"
              >
                Copy summary
              </button>
              <button
                className="rounded-md border border-[#1f6f56] bg-[#e7f0eb] px-4 py-2 text-sm font-semibold text-[#164f3f]"
                onClick={saveVisit}
                type="button"
              >
                Save visit
              </button>
              <button
                className="rounded-md border border-[#bdc8ba] bg-white px-4 py-2 text-sm font-semibold"
                onClick={exportJson}
                type="button"
              >
                Export JSON
              </button>
            </div>
          </div>

          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold">What it asks</h2>
            <div className="mt-4 space-y-3">
              {requiredQuestions.map((question, index) => (
                <div className="border border-[#dce3d9] bg-[#fbfcfa] p-3" key={question.key}>
                  <p className="text-sm font-semibold">
                    {index + 1}. {question.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#64736d]">
                    {question.question}
                  </p>
                </div>
              ))}
              <div className="border border-[#dce3d9] bg-[#fbfcfa] p-3">
                <p className="text-sm font-semibold">5. Onsite overview</p>
                <p className="mt-1 text-sm leading-6 text-[#64736d]">
                  A natural-language recap of what happened, what workflows were
                  touched, what was broken, and what follow-up is needed.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold">Saved visits</h2>
            {savedVisits.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-[#64736d]">
                Saved visits will appear here on this browser.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {savedVisits.map((visit) => (
                  <article className="border border-[#dce3d9] bg-[#fbfcfa] p-3" key={visit.id}>
                    <p className="font-semibold">{visit.customerName}</p>
                    <p className="text-sm text-[#64736d]">{visit.customerId}</p>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#43514c]">
                      {visit.summary}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="border border-[#d9ded6] bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold">Table targets</h2>
            <div className="mt-4 space-y-3">
              {sectionRows.map((section) => (
                <div key={section.key}>
                  <p className="text-sm font-semibold">{section.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#64736d]">
                    {section.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 border border-[#d7ded3] bg-[#fbfcfa] px-4 py-2">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#64736d]">
        {label}
      </p>
    </div>
  );
}
