# ShipHero Onsite Compass

Guided web app for capturing customer onsite visits, training observations, workflow issues, follow-up actions, and reusable trend signals.

## What It Captures

- Account context: account name, account ID, ARR, location, visit date, onsite lead, stakeholders, and visit objective.
- Operation snapshot: facility profile, order volume, SKU count, shifts, integrations, pain points, and training gaps.
- Workflow walkthrough: receiving, putaway, inventory, replenishment, picking, packing, shipping, returns, and integrations.
- Notes and transcription: typed notes, browser dictation where supported, and recorded audio for OpenAI transcription when configured.
- Closeout: blockers, recommendations, customer sentiment, follow-up owner, follow-up due date, AI-ready summary, and trend tags.
- Catalog: locally saved visit records and JSON export for downstream analysis.

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
OPENAI_SUMMARY_MODEL=...
OPENAI_TRANSCRIPTION_MODEL=...
```

Without those values, the app still works with browser dictation, local summary drafting, local catalog saves, and JSON export.

## GitHub and Vercel

1. Push this project to a private GitHub repo.
2. Import the repo in Vercel as a Next.js project.
3. Add the OpenAI environment variables in Vercel Project Settings.
4. Let Vercel create preview deployments for pull requests and production deployments from `main`.

The included GitHub Action runs install, lint, and build on pushes and pull requests.

## Recommended Next Iterations

- Add authentication for ShipHero users.
- Store visits in a shared database instead of browser storage.
- Add customer/account lookup from CRM or internal account systems.
- Add dashboards for trend analysis by workflow, root cause, ARR risk, and customer segment.
- Package the same flow as a private iOS app once the workflow stabilizes.
