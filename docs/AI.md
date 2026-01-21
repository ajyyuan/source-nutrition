# Intake — AI Rules & Guardrails

## Purpose

This document defines how AI is allowed to behave in Intake. These rules exist to prevent hallucination, unsafe claims, and brittle logic.

---

## Allowed AI Responsibilities

* Identify foods in images
* Estimate portion sizes (grams)
* Output structured, machine-validated JSON

AI is **not** a source of truth.

---

## Required Output Schema (Conceptual)

Each parsed item must include:

* name (string)
* estimated_grams (number)
* confidence (0–1)

Output must be strict JSON. No prose.

---

## Confidence Handling

* All AI outputs are estimates
* Confidence must be surfaced in the UI
* Low-confidence outputs must be easy to edit or replace

---

## Hallucination Rules

* If unsure, AI should return fewer items, not more
* Unknown foods must be labeled as such
* No guessing additives or nutrients without a canonical mapping

---

## Failure Modes

If AI fails:

* Return an empty or partial result
* Prompt user to add foods manually
* Never fabricate data

---

## Safety & Claims

* No medical advice
* No disease prevention or treatment claims
* Nutrient data must be framed as informational only

---

## Non-Negotiables

* AI output must always be validated
* Frontend must allow full user override
* Estimates must be explicit

Violating these rules is grounds for rejection or rollback.

---

## Security Implications of AI Output

- AI output is untrusted input
- All AI responses must be validated before use
- AI must not introduce executable code, URLs, or scripts into the app
- AI-derived values must never bypass auth or access controls
