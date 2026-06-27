# ShipHero Onsite Compass

Conversational web app for capturing customer onsite visits without forcing the user through a long form.

## TLDR

The app asks a few mandatory setup questions, then lets the onsite team member explain the visit naturally. It organizes that narrative into a structured table that can later be summarized, exported, searched, and analyzed for trends.

## Flow

1. Press **Start visit**.
2. Answer the required setup questions:
   - Customer name
   - Customer ID
   - Onsite location
   - Reason ShipHero is onsite
3. Give the onsite overview in plain language.
4. The app organizes the overview into:
   - Account
   - Overview
   - Workflows
   - Issues and risks
   - Training gaps
   - Recommendations
   - Follow-up
   - Trend tags
5. If the visit record is not good enough, the app prompts for missing information.
6. Generate a summary, save the visit locally, or export JSON.

## AI Behavior

The app is ready for OpenAI keys, but it also works without them.

Without API keys:

- Required-question flow works
- Browser dictation works where supported
- Local parsing organizes notes using workflow and issue keywords
- Local summaries work
- Local save and JSON export work

With API keys:

- `/api/organize` uses `gpt-5.5` by default to classify the narrative into the proper structured table
- `/api/summary` uses `gpt-5.5` by default to write the final closeout summary
- `/api/transcribe` uses `gpt-4o-transcribe` by default for higher-quality audio transcription

## Local Setup

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## OpenAI Configuration

Create `.env.local` from `.env.example` and set:

```bash
OPENAI_API_KEY=...
```

That is the only required variable. The app has best-quality model defaults in
code. Optional overrides are available if you later want to tune cost or latency:

```bash
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_ORGANIZE_MODEL=gpt-5.5
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
```

## Vercel

1. Import the GitHub repo in Vercel.
2. Keep the framework as Next.js.
3. Add `OPENAI_API_KEY` when ready.
4. Deploy.

The app deploys without API keys; AI calls fall back to local behavior until keys are configured.

## Recommended Next Iterations

- Add ShipHero login.
- Store visits in a shared database instead of browser storage.
- Add account lookup from CRM or internal systems.
- Add recorded-audio upload in the conversational UI.
- Build a trends dashboard by workflow, root cause, ARR risk, and customer segment.
- Package the stabilized flow as a private iOS app.
