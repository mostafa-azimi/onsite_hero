# ShipHero Onsite Compass Conversation Blueprint

## Product Intent

The user should not fill out a long operational form onsite. The app should ask only the minimum required setup questions, then let the user describe the visit naturally. AI or local parsing turns that narrative into structured data.

## Mandatory Questions

1. What is the customer name?
2. What is their customer ID?
3. Where is this onsite happening?
4. What is the main reason ShipHero is onsite?

## Freeform Prompt

After the mandatory questions, ask for a natural-language overview:

> Tell me what happened onsite. Mention what workflows you observed, what training happened, what was broken or confusing, what customer impact you saw, and what follow-up is needed.

## Organized Table

The app should organize the conversation into:

- Account
- Overview
- Workflows
- Issues and risks
- Training gaps
- Recommendations
- Follow-up
- Trend tags

## Workflow Targets

The parser should identify mentions of:

- Receiving
- Putaway
- Inventory
- Replenishment
- Picking
- Packing
- Shipping
- Returns
- Integrations

## Minimum Record Quality

If any of these are missing, the app should ask follow-up questions:

- Customer name
- Customer ID
- Onsite location
- Visit objective
- Full onsite overview
- At least one workflow reviewed, trained, or troubleshot
- Whether there were blockers or risks
- Follow-up, recommendation, or explicit note that none is needed

## Structured Output

Each visit should be exportable as JSON with:

- Required account fields
- Raw overview and additional context
- Organized table
- Missing-info prompts
- Summary
- Trend tags

## Later Enhancements

- Shared database
- ShipHero login
- CRM/account lookup
- Audio upload and transcription in the same conversation
- Trend dashboard by workflow, root cause, customer segment, and ARR risk
