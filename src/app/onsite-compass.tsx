"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WorkflowStatus =
  | "Not reviewed"
  | "Observed"
  | "Trained"
  | "Issue found"
  | "Follow-up";

type Severity = "None" | "Low" | "Medium" | "High";

type WorkflowEntry = {
  id: string;
  name: string;
  prompt: string;
  status: WorkflowStatus;
  severity: Severity;
  rootCause: string;
  notes: string;
  nextStep: string;
};

type VisitReport = {
  id: string;
  savedAt: string;
  accountName: string;
  accountId: string;
  location: string;
  summary: string;
  workflows: string[];
  tags: string[];
};

type OnsiteForm = {
  accountName: string;
  accountId: string;
  arr: string;
  location: string;
  visitDate: string;
  onsiteLead: string;
  stakeholders: string;
  visitObjective: string;
  facilityProfile: string;
  ordersPerDay: string;
  skuCount: string;
  shifts: string;
  integrations: string;
  painPoints: string;
  trainingGaps: string;
  blockers: string;
  recommendations: string;
  customerSentiment: string;
  followUpOwner: string;
  followUpDate: string;
  generalNotes: string;
  transcript: string;
  trendTags: string[];
  workflows: WorkflowEntry[];
  aiSummary: string;
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
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const STORAGE_KEY = "shiphero-onsite-compass-current";
const REPORTS_KEY = "shiphero-onsite-compass-reports";

const workflowTemplates: Omit<
  WorkflowEntry,
  "status" | "severity" | "rootCause" | "notes" | "nextStep"
>[] = [
  {
    id: "receiving",
    name: "Receiving",
    prompt: "ASN, blind receiving, exception handling, labels, staging.",
  },
  {
    id: "putaway",
    name: "Putaway",
    prompt: "Directed putaway, bins, scan discipline, overflow process.",
  },
  {
    id: "inventory",
    name: "Inventory",
    prompt: "Cycle counts, adjustments, location accuracy, quarantine.",
  },
  {
    id: "replenishment",
    name: "Replenishment",
    prompt: "Min/max logic, forward pick health, task ownership.",
  },
  {
    id: "picking",
    name: "Picking",
    prompt: "Single, batch, tote, cart, zone, wave, exception handling.",
  },
  {
    id: "packing",
    name: "Packing",
    prompt: "QC, pack station layout, materials, rate, reprint flow.",
  },
  {
    id: "shipping",
    name: "Shipping",
    prompt: "Carrier rules, label generation, manifests, pickups.",
  },
  {
    id: "returns",
    name: "Returns",
    prompt: "Disposition, restock, quarantine, refunds, exchange flow.",
  },
  {
    id: "integrations",
    name: "Integrations",
    prompt: "Shopify, ERP, carriers, automation, reporting, error queues.",
  },
];

const statusOptions: WorkflowStatus[] = [
  "Not reviewed",
  "Observed",
  "Trained",
  "Issue found",
  "Follow-up",
];

const severityOptions: Severity[] = ["None", "Low", "Medium", "High"];

const rootCauseOptions = [
  "Training",
  "SOP gap",
  "Configuration",
  "Integration",
  "Hardware or network",
  "Inventory accuracy",
  "Labor planning",
  "Product feedback",
];

const trendTagOptions = [
  "Go-live readiness",
  "Training needed",
  "Workflow redesign",
  "Support follow-up",
  "Product feedback",
  "Integration risk",
  "ARR risk",
  "Expansion opportunity",
];

const defaultWorkflows = (): WorkflowEntry[] =>
  workflowTemplates.map((workflow) => ({
    ...workflow,
    status: "Not reviewed",
    severity: "None",
    rootCause: "",
    notes: "",
    nextStep: "",
  }));

const createDefaultForm = (): OnsiteForm => ({
  accountName: "",
  accountId: "",
  arr: "",
  location: "",
  visitDate: new Date().toISOString().slice(0, 10),
  onsiteLead: "",
  stakeholders: "",
  visitObjective: "",
  facilityProfile: "",
  ordersPerDay: "",
  skuCount: "",
  shifts: "",
  integrations: "",
  painPoints: "",
  trainingGaps: "",
  blockers: "",
  recommendations: "",
  customerSentiment: "Neutral",
  followUpOwner: "",
  followUpDate: "",
  generalNotes: "",
  transcript: "",
  trendTags: [],
  workflows: defaultWorkflows(),
  aiSummary: "",
});

function mergeForm(input: Partial<OnsiteForm>): OnsiteForm {
  const base = createDefaultForm();
  const incomingWorkflows = Array.isArray(input.workflows)
    ? input.workflows
    : [];
  const workflows = base.workflows.map((workflow) => {
    const match = incomingWorkflows.find((entry) => entry.id === workflow.id);
    return match ? { ...workflow, ...match } : workflow;
  });

  return {
    ...base,
    ...input,
    workflows,
    trendTags: Array.isArray(input.trendTags) ? input.trendTags : [],
  };
}

function readStoredForm() {
  if (typeof window === "undefined") {
    return createDefaultForm();
  }

  const storedForm = window.localStorage.getItem(STORAGE_KEY);
  if (!storedForm) {
    return createDefaultForm();
  }

  try {
    return mergeForm(JSON.parse(storedForm) as Partial<OnsiteForm>);
  } catch {
    return createDefaultForm();
  }
}

function readStoredReports() {
  if (typeof window === "undefined") {
    return [];
  }

  const storedReports = window.localStorage.getItem(REPORTS_KEY);
  if (!storedReports) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedReports);
    return Array.isArray(parsed) ? (parsed as VisitReport[]) : [];
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

function getStatusClass(status: WorkflowStatus) {
  if (status === "Issue found") {
    return "border-[#b8322a] bg-[#fff1ef] text-[#8f241e]";
  }
  if (status === "Follow-up") {
    return "border-[#b06b00] bg-[#fff6df] text-[#8a5400]";
  }
  if (status === "Trained") {
    return "border-[#1f6f56] bg-[#e7f0eb] text-[#1f6f56]";
  }
  if (status === "Observed") {
    return "border-[#326bba] bg-[#eef5ff] text-[#28528c]";
  }
  return "border-[#d8ded6] bg-white text-[#5f6e68]";
}

function buildLocalSummary(form: OnsiteForm) {
  const activeWorkflows = form.workflows
    .filter((workflow) => workflow.status !== "Not reviewed")
    .map((workflow) => `${workflow.name} (${workflow.status})`);
  const riskWorkflows = form.workflows.filter(
    (workflow) =>
      workflow.status === "Issue found" || workflow.status === "Follow-up",
  );
  const rootCauses = [
    ...new Set(
      form.workflows
        .map((workflow) => workflow.rootCause)
        .filter((cause) => cause.trim().length > 0),
    ),
  ];

  return [
    `Account: ${form.accountName || "Unspecified"} (${form.accountId || "no ID"})`,
    `Location: ${form.location || "Unspecified"}; ARR: ${form.arr || "Unspecified"}.`,
    `Visit objective: ${form.visitObjective || "Not captured"}.`,
    `Workflows reviewed: ${
      activeWorkflows.length > 0 ? activeWorkflows.join(", ") : "None marked yet"
    }.`,
    `Primary risks: ${
      riskWorkflows.length > 0
        ? riskWorkflows
            .map((workflow) => `${workflow.name} - ${workflow.severity}`)
            .join(", ")
        : "No issue workflows marked"
    }.`,
    `Likely themes: ${
      [...form.trendTags, ...rootCauses].length > 0
        ? [...form.trendTags, ...rootCauses].join(", ")
        : "No tags captured yet"
    }.`,
    `Recommended next steps: ${form.recommendations || "Not captured"}.`,
  ].join("\n");
}

export default function OnsiteCompass() {
  const [form, setForm] = useState<OnsiteForm>(() => readStoredForm());
  const [reports, setReports] = useState<VisitReport[]>(() =>
    readStoredReports(),
  );
  const [activeSection, setActiveSection] = useState("account");
  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported] = useState(() => hasSpeechSupport());
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");
  const [transcriptionState, setTranscriptionState] = useState<
    "idle" | "working" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  }, [reports]);

  const requiredProgress = useMemo(() => {
    const checks = [
      form.accountName.trim(),
      form.accountId.trim(),
      form.location.trim(),
      form.visitObjective.trim(),
      form.workflows.some((workflow) => workflow.status !== "Not reviewed"),
      form.blockers.trim(),
    ];
    const completed = checks.filter(Boolean).length;
    return {
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [form]);

  const workflowStats = useMemo(() => {
    const reviewed = form.workflows.filter(
      (workflow) => workflow.status !== "Not reviewed",
    ).length;
    const issues = form.workflows.filter(
      (workflow) => workflow.status === "Issue found",
    ).length;
    const followUps = form.workflows.filter(
      (workflow) => workflow.status === "Follow-up",
    ).length;

    return { reviewed, issues, followUps };
  }, [form.workflows]);

  const summaryPreview = form.aiSummary || buildLocalSummary(form);

  function updateField<K extends keyof OnsiteForm>(
    field: K,
    value: OnsiteForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateWorkflow(
    id: string,
    patch: Partial<Omit<WorkflowEntry, "id" | "name" | "prompt">>,
  ) {
    setForm((current) => ({
      ...current,
      workflows: current.workflows.map((workflow) =>
        workflow.id === id ? { ...workflow, ...patch } : workflow,
      ),
    }));
  }

  function toggleTag(tag: string) {
    setForm((current) => {
      const hasTag = current.trendTags.includes(tag);
      return {
        ...current,
        trendTags: hasTag
          ? current.trendTags.filter((item) => item !== tag)
          : [...current.trendTags, tag],
      };
    });
  }

  function appendNote(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setForm((current) => ({
      ...current,
      transcript: [current.transcript, trimmed].filter(Boolean).join("\n"),
      generalNotes: [current.generalNotes, trimmed].filter(Boolean).join("\n"),
    }));
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
        appendNote(finalText);
      }
      setInterimTranscript(interimText);
    };
    recognition.onerror = () => {
      setMessage("Dictation stopped before a transcript was captured.");
      setIsDictating(false);
    };
    recognition.onend = () => {
      setIsDictating(false);
      setInterimTranscript("");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
    setMessage("");
  }

  async function toggleAudioRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Audio recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      streamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setMessage("");
    } catch {
      setMessage("Microphone access was not granted.");
    }
  }

  async function transcribeAudio() {
    if (!audioBlob) {
      setMessage("Record audio first, then send it for transcription.");
      return;
    }

    setTranscriptionState("working");
    setMessage("");

    try {
      const data = new FormData();
      data.append("file", audioBlob, "onsite-note.webm");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as {
        text?: string;
        error?: string;
      };

      if (!response.ok || !result.text) {
        throw new Error(result.error || "Transcription failed.");
      }

      appendNote(result.text);
      setTranscriptionState("idle");
      setMessage("AI transcription added to notes.");
    } catch (error) {
      setTranscriptionState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "AI transcription could not be completed.",
      );
    }
  }

  async function generateSummary() {
    setAiState("working");
    setMessage("");

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as {
        summary?: string;
        source?: string;
        error?: string;
      };

      if (!response.ok || !result.summary) {
        throw new Error(result.error || "Summary failed.");
      }

      updateField("aiSummary", result.summary);
      setAiState("idle");
      setMessage(
        result.source === "openai"
          ? "AI summary generated."
          : "Draft summary generated locally. Add OpenAI env vars for model output.",
      );
    } catch (error) {
      setAiState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Summary could not be generated.",
      );
    }
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summaryPreview);
    setMessage("Summary copied.");
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      report: form,
      summary: summaryPreview,
      workflowStats,
      requiredProgress,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form.accountName || "onsite-report"}-${form.visitDate}.json`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  function saveReport() {
    const report: VisitReport = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      accountName: form.accountName || "Unnamed account",
      accountId: form.accountId,
      location: form.location,
      summary: summaryPreview,
      workflows: form.workflows
        .filter((workflow) => workflow.status !== "Not reviewed")
        .map((workflow) => workflow.name),
      tags: form.trendTags,
    };
    setReports((current) => [report, ...current].slice(0, 12));
    setMessage("Visit saved to the local catalog.");
  }

  function resetDraft() {
    setForm(createDefaultForm());
    setAudioBlob(null);
    setMessage("Draft reset.");
  }

  const sections = [
    { id: "account", label: "Account", complete: form.accountName && form.accountId },
    { id: "operation", label: "Operation", complete: form.location },
    {
      id: "workflows",
      label: "Workflows",
      complete: workflowStats.reviewed > 0,
    },
    { id: "notes", label: "Notes", complete: form.generalNotes || form.transcript },
    { id: "closeout", label: "Closeout", complete: form.blockers },
    { id: "catalog", label: "Catalog", complete: reports.length > 0 },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f2] text-[#17211d]">
      <div className="border-b border-[#d7ded3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1f6f56]">
              ShipHero onsite compass
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
              Guided customer onsite visit capture
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Required" value={`${requiredProgress.percent}%`} />
            <Metric label="Reviewed" value={`${workflowStats.reviewed}/9`} />
            <Metric
              label="Needs eyes"
              value={`${workflowStats.issues + workflowStats.followUps}`}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit border border-[#d7ded3] bg-white p-3">
          <div className="px-2 py-2">
            <p className="text-sm font-semibold">Visit progress</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e3e7df]">
              <div
                className="h-full rounded-full bg-[#1f6f56]"
                style={{ width: `${requiredProgress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-[#64736d]">
              {requiredProgress.completed} of {requiredProgress.total} required
              signals captured
            </p>
          </div>

          <nav className="mt-3 space-y-1">
            {sections.map((section, index) => (
              <button
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  activeSection === section.id
                    ? "bg-[#e7f0eb] text-[#164f3f]"
                    : "hover:bg-[#f4f6f2]"
                }`}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#46615a]">
                    {index + 1}
                  </span>
                  {section.label}
                </span>
                <span
                  aria-label={section.complete ? "Complete" : "Incomplete"}
                  className={`h-2.5 w-2.5 rounded-full ${
                    section.complete ? "bg-[#1f6f56]" : "bg-[#c9d1c5]"
                  }`}
                />
              </button>
            ))}
          </nav>

          <div className="mt-5 border-t border-[#e0e5dd] px-2 pt-4">
            <p className="text-sm font-semibold">Core field blueprint</p>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-[#5f6e68]">
              <li>Account facts and commercial context</li>
              <li>Warehouse profile and operational scale</li>
              <li>Workflow status, severity, and root cause</li>
              <li>Raw notes, transcript, recommendations</li>
              <li>Follow-up owner, due date, trend tags</li>
            </ul>
          </div>
        </aside>

        <div className="space-y-5">
          {message ? (
            <div className="border border-[#cfd8cc] bg-white px-4 py-3 text-sm text-[#43514c]">
              {message}
            </div>
          ) : null}

          <Panel
            active={activeSection === "account"}
            eyebrow="Required"
            id="account"
            title="Account context"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextInput
                label="Account name"
                onChange={(value) => updateField("accountName", value)}
                required
                value={form.accountName}
              />
              <TextInput
                label="Account ID"
                onChange={(value) => updateField("accountId", value)}
                required
                value={form.accountId}
              />
              <TextInput
                label="ARR"
                onChange={(value) => updateField("arr", value)}
                placeholder="$"
                value={form.arr}
              />
              <TextInput
                label="Visit date"
                onChange={(value) => updateField("visitDate", value)}
                type="date"
                value={form.visitDate}
              />
              <TextInput
                label="Onsite lead"
                onChange={(value) => updateField("onsiteLead", value)}
                value={form.onsiteLead}
              />
              <TextInput
                label="Customer stakeholders"
                onChange={(value) => updateField("stakeholders", value)}
                value={form.stakeholders}
              />
            </div>
            <TextArea
              label="Visit objective"
              onChange={(value) => updateField("visitObjective", value)}
              placeholder="Example: train floor leads on picking and troubleshoot pack station delays."
              required
              value={form.visitObjective}
            />
          </Panel>

          <Panel
            active={activeSection === "operation"}
            eyebrow="Required"
            id="operation"
            title="Operation snapshot"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextInput
                label="Onsite location"
                onChange={(value) => updateField("location", value)}
                required
                value={form.location}
              />
              <TextInput
                label="Orders per day"
                onChange={(value) => updateField("ordersPerDay", value)}
                value={form.ordersPerDay}
              />
              <TextInput
                label="SKU count"
                onChange={(value) => updateField("skuCount", value)}
                value={form.skuCount}
              />
              <TextInput
                label="Shifts"
                onChange={(value) => updateField("shifts", value)}
                value={form.shifts}
              />
              <TextInput
                label="Integrations in scope"
                onChange={(value) => updateField("integrations", value)}
                value={form.integrations}
              />
              <TextInput
                label="Facility profile"
                onChange={(value) => updateField("facilityProfile", value)}
                value={form.facilityProfile}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextArea
                label="Current pain points"
                onChange={(value) => updateField("painPoints", value)}
                value={form.painPoints}
              />
              <TextArea
                label="Training gaps or SOP drift"
                onChange={(value) => updateField("trainingGaps", value)}
                value={form.trainingGaps}
              />
            </div>
          </Panel>

          <Panel
            active={activeSection === "workflows"}
            eyebrow="Required"
            id="workflows"
            title="Workflow walkthrough"
          >
            <div className="space-y-3">
              {form.workflows.map((workflow) => (
                <div
                  className="border border-[#dce3d9] bg-[#fbfcfa] p-4"
                  key={workflow.id}
                >
                  <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                    <div>
                      <p className="font-semibold">{workflow.name}</p>
                      <p className="mt-1 text-sm leading-5 text-[#64736d]">
                        {workflow.prompt}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            className={`rounded-md border px-3 py-2 text-sm font-medium ${getStatusClass(
                              workflow.status === status
                                ? status
                                : "Not reviewed",
                            )} ${
                              workflow.status === status
                                ? ""
                                : "opacity-70 hover:opacity-100"
                            }`}
                            key={status}
                            onClick={() => updateWorkflow(workflow.id, { status })}
                            type="button"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <SelectInput
                          label="Severity"
                          onChange={(value) =>
                            updateWorkflow(workflow.id, {
                              severity: value as Severity,
                            })
                          }
                          options={severityOptions}
                          value={workflow.severity}
                        />
                        <SelectInput
                          label="Root cause"
                          onChange={(value) =>
                            updateWorkflow(workflow.id, { rootCause: value })
                          }
                          options={["", ...rootCauseOptions]}
                          value={workflow.rootCause}
                        />
                        <TextInput
                          label="Next step"
                          onChange={(value) =>
                            updateWorkflow(workflow.id, { nextStep: value })
                          }
                          value={workflow.nextStep}
                        />
                      </div>
                      <TextArea
                        label="Workflow notes"
                        onChange={(value) =>
                          updateWorkflow(workflow.id, { notes: value })
                        }
                        value={workflow.notes}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            active={activeSection === "notes"}
            eyebrow="Voice enabled"
            id="notes"
            title="Notes, dictation, and transcription"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <TextArea
                label="Raw onsite notes"
                onChange={(value) => updateField("generalNotes", value)}
                placeholder="Type notes, paste Slack follow-up, or add transcript output here."
                rows={10}
                value={form.generalNotes}
              />
              <div className="space-y-3">
                <button
                  className="w-full rounded-md bg-[#17211d] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#a9b3ad]"
                  disabled={!speechSupported}
                  onClick={toggleDictation}
                  type="button"
                >
                  {isDictating ? "Stop browser dictation" : "Start dictation"}
                </button>
                <button
                  className="w-full rounded-md border border-[#b8c3b5] bg-white px-4 py-3 text-sm font-semibold"
                  onClick={toggleAudioRecording}
                  type="button"
                >
                  {isRecording ? "Stop audio recording" : "Record audio note"}
                </button>
                <button
                  className="w-full rounded-md border border-[#1f6f56] bg-[#e7f0eb] px-4 py-3 text-sm font-semibold text-[#164f3f] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!audioBlob || transcriptionState === "working"}
                  onClick={transcribeAudio}
                  type="button"
                >
                  {transcriptionState === "working"
                    ? "Transcribing..."
                    : "Send audio to AI transcription"}
                </button>
                <div className="border border-[#dce3d9] bg-[#fbfcfa] p-3 text-sm leading-6 text-[#5f6e68]">
                  Browser dictation is instant where supported. Audio
                  transcription uses the server route when OpenAI environment
                  variables are set.
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TextArea
                label="Transcript log"
                onChange={(value) => updateField("transcript", value)}
                rows={6}
                value={[
                  form.transcript,
                  interimTranscript ? `Listening: ${interimTranscript}` : "",
                ]
                  .filter(Boolean)
                  .join("\n")}
              />
              <div>
                <p className="text-sm font-medium">Trend tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {trendTagOptions.map((tag) => (
                    <button
                      className={`rounded-md border px-3 py-2 text-sm ${
                        form.trendTags.includes(tag)
                          ? "border-[#1f6f56] bg-[#e7f0eb] text-[#164f3f]"
                          : "border-[#d7ded3] bg-white text-[#50605a]"
                      }`}
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            active={activeSection === "closeout"}
            eyebrow="Required"
            id="closeout"
            title="Closeout and action plan"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <TextArea
                label="Blockers or risks"
                onChange={(value) => updateField("blockers", value)}
                required
                value={form.blockers}
              />
              <TextArea
                label="Recommendations"
                onChange={(value) => updateField("recommendations", value)}
                value={form.recommendations}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectInput
                label="Customer sentiment"
                onChange={(value) => updateField("customerSentiment", value)}
                options={["Positive", "Neutral", "Concerned", "At risk"]}
                value={form.customerSentiment}
              />
              <TextInput
                label="Follow-up owner"
                onChange={(value) => updateField("followUpOwner", value)}
                value={form.followUpOwner}
              />
              <TextInput
                label="Follow-up due"
                onChange={(value) => updateField("followUpDate", value)}
                type="date"
                value={form.followUpDate}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">AI-ready summary</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md bg-[#17211d] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#a9b3ad]"
                      disabled={aiState === "working"}
                      onClick={generateSummary}
                      type="button"
                    >
                      {aiState === "working" ? "Summarizing..." : "Generate"}
                    </button>
                    <button
                      className="rounded-md border border-[#b8c3b5] bg-white px-4 py-2 text-sm font-semibold"
                      onClick={copySummary}
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <pre className="mt-2 min-h-64 whitespace-pre-wrap border border-[#dce3d9] bg-[#fbfcfa] p-4 text-sm leading-6 text-[#33423d]">
                  {summaryPreview}
                </pre>
              </div>
              <div className="space-y-3">
                <button
                  className="w-full rounded-md border border-[#1f6f56] bg-[#e7f0eb] px-4 py-3 text-sm font-semibold text-[#164f3f]"
                  onClick={saveReport}
                  type="button"
                >
                  Save to catalog
                </button>
                <button
                  className="w-full rounded-md border border-[#b8c3b5] bg-white px-4 py-3 text-sm font-semibold"
                  onClick={exportJson}
                  type="button"
                >
                  Export JSON
                </button>
                <button
                  className="w-full rounded-md border border-[#d7b2ad] bg-[#fff1ef] px-4 py-3 text-sm font-semibold text-[#8f241e]"
                  onClick={resetDraft}
                  type="button"
                >
                  Reset draft
                </button>
              </div>
            </div>
          </Panel>

          <Panel
            active={activeSection === "catalog"}
            eyebrow="Local"
            id="catalog"
            title="Visit catalog and trend signals"
          >
            {reports.length === 0 ? (
              <div className="border border-dashed border-[#bfc9bb] bg-[#fbfcfa] p-6 text-sm leading-6 text-[#5f6e68]">
                Saved reports will appear here. This is the first step toward a
                centralized trend catalog across onsite visits.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <article
                    className="border border-[#dce3d9] bg-[#fbfcfa] p-4"
                    key={report.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{report.accountName}</h3>
                        <p className="text-sm text-[#64736d]">
                          {report.accountId || "No account ID"} -{" "}
                          {report.location || "No location"}
                        </p>
                      </div>
                      <p className="text-sm text-[#64736d]">
                        {new Date(report.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#43514c]">
                      {report.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[...report.workflows, ...report.tags].map((tag) => (
                        <span
                          className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#4f625b]"
                          key={`${report.id}-${tag}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
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

function Panel({
  active,
  children,
  eyebrow,
  id,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`border border-[#d7ded3] bg-white p-4 sm:p-5 ${
        active ? "block" : "hidden"
      }`}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#1f6f56]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-semibold" id={`${id}-title`}>
            {title}
          </h2>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function TextInput({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-[#b8322a]"> *</span> : null}
      </span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-[#cfd8cc] bg-white px-3 text-sm outline-none transition focus:border-[#1f6f56] focus:ring-2 focus:ring-[#cfe1d9]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectInput({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-md border border-[#cfd8cc] bg-white px-3 text-sm outline-none transition focus:border-[#1f6f56] focus:ring-2 focus:ring-[#cfe1d9]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  onChange,
  placeholder,
  required,
  rows = 4,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-[#b8322a]"> *</span> : null}
      </span>
      <textarea
        className="mt-2 w-full resize-y rounded-md border border-[#cfd8cc] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#1f6f56] focus:ring-2 focus:ring-[#cfe1d9]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </label>
  );
}
