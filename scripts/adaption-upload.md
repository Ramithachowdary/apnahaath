# Adaption — Care Communication Engine dataset

`data/adaption/care-communication.jsonl` holds 20 hand-written prompt/completion rows for the fictional
Kamla household (three registers: elder / caretaker / family; refuses every dose change).

## Use at runtime (no training needed)

Set `ADAPTION_API_KEY` (and optionally `ADAPTION_MODEL`, default `gemma-4-31b-it`, or `ADAPTION_STACK_ID`
to call `stack:<slug>`). `src/lib/adaption.ts` calls `POST https://api.prod.adaptionlabs.ai/api/v1/responses`
with `{ model, instructions, input, max_output_tokens, temperature }` and reads `output_text`
(per https://docs.adaptionlabs.ai/api/resources/responses/methods/create/). 8 s timeout; on any error,
missing key, or output that implies a dose change, it falls back to deterministic templates.

## Optional: upload the dataset (estimate first)

```bash
pip install adaption
export ADAPTION_API_KEY=pt_live_...
python - <<'PY'
from adaption import Adaption
c = Adaption()
ds = c.datasets.create(file=open("data/adaption/care-communication.jsonl", "rb"))   # Datasets → Create
print(ds.id)
# Estimate cost before adapting (Datasets → Adapt supports an estimate mode; check the response before running)
PY
```

Then, in the Adaption app, create an inference stack that uses the adapted dataset (file_search) and set
`ADAPTION_STACK_ID` to its slug. Gemini still decides the safety note; Adaption only rewrites it.
