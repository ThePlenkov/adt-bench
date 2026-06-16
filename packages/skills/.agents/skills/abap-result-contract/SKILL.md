---
name: abap-result-contract
description: How to return a strict scenario result JSON with evidence and no extra prose.
---

# abap-result-contract

Your final answer **must** be a single JSON object matching this shape:

```json
{
  "scenario_id": "string",
  "status": "pass | fail | partial",
  "summary": "string",
  "evidence": [
    { "kind": "object | source | activation | syntax_check | test | diagnostic | tool_result | other", "value": "string" }
  ],
  "changed_objects": ["string"],
  "errors": ["string"]
}
```

Rules:

- The JSON object must be the **only** content of your final answer.
- Do not include prose, code fences (```), or markdown before or after the JSON.
- If your tool produced code-fenced output, you may strip the fences.
- `summary` should be 1–3 sentences, plain text, no markdown.
- `evidence` should be ordered roughly chronologically. Prefer the strongest evidence (activation, unit test) first.
- `changed_objects` is a list of ABAP object names you created or modified.
- `errors` is a list of human-readable error strings; empty if nothing failed.
- `status` rules:
  - `pass` — the task is fully done and validated.
  - `partial` — you made progress but the task is not complete; explain in `summary`.
  - `fail` — you could not do the task; explain in `errors`.
