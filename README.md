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

- `/api/organize` can use an OpenAI model to classify the narrative into the proper structured table
- `/api/summary` can use an OpenAI model to write the final closeout summary
- `/api/transcribe` is available for future recorded-audio transcription

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
OPENAI_ORGANIZE_MODEL=...
OPENAI_SUMMARY_MODEL=...
OPENAI_TRANSCRIPTION_MODEL=...
```

`OPENAI_ORGANIZE_MODEL` can use the same model as `OPENAI_SUMMARY_MODEL`.

## Vercel

1. Import the GitHub repo in Vercel.
2. Keep the framework as Next.js.
3. Add the OpenAI environment variables later when ready.
4. Deploy.

The app deploys without API keys; AI calls fall back to local behavior until keys are configured.

## Recommended Next Iterations

- Add ShipHero login.
- Store visits in a shared database instead of browser storage.
- Add account lookup from CRM or internal systems.
- Add recorded-audio upload in the conversational UI.
- Build a trends dashboard by workflow, root cause, ARR risk, and customer segment.
- Package the stabilized flow as a private iOS app.
