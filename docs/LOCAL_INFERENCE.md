# ΦFractalCity R0.3: One-shot local model conversation

This is an **opt-in** local inference experiment. It does **not** yet connect to
the PhiStream executable, Agentora orchestration, a cloud model or a persistent
autonomous agent. PhiStream's current public README describes a research-grade
token-ID inference engine, not a general chat HTTP service. The first adapter
targets an existing local **Ollama** installation to make the experience
immediately testable while keeping the future inference adapter replaceable.

## Run on a desktop with Ollama

1. Install a recent Node.js and run the project:

   \`\`\`sh
   npm install
   npm run check
   npm run dev
   \`\`\`

2. Install and start Ollama locally, with a compatible **chat** model installed.
   R0.3 defaults the model ID to \`qwen3:4b\`; you may enter the ID of any other
   locally installed Ollama chat model. Model weights are **not** downloaded by
   the city app.
3. In **Talk to Ori**, enter a question and press **Ask local Ori**. Only that
   button initiates an inference request.
4. Read the unverified answer. If you want to keep it as a potential creation,
   click **Stage reply as proposal for review**. It remains pending until you
   separately approve it in the Workshop. Approval creates a visual concept
   marker, not an actual complete building or any code change.

The only network endpoint used by the adapter is:

\`\`\`
POST http://127.0.0.1:11434/api/chat
\`\`\`

The destination is hard-coded to loopback (the current browser's machine),
not a URL entered by the visitor. The model name is validated as a model ID,
not interpreted as an endpoint. Requests include no credentials and
\`stream:false\`, with a 192-token generation budget and a 30-second timeout.

## If the browser reports CORS or connection errors

Ollama must already be running, and its CORS policy must allow the **exact
origin** serving PhiFractalCity. For example, if you run the local Vite dev
server, use only its printed origin, such as \`http://localhost:5173\`.
When serving from GitHub Pages, its origin is
\`https://michaelwave369.github.io\` (no path in the origin).

You can configure Ollama's documented \`OLLAMA_ORIGINS\` environment variable
with *that specific origin*, then restart the local Ollama process. Avoid
using \`*\`, binding Ollama to \`0.0.0.0\`, or exposing it publicly. The exact
process restart steps depend on your operating system and how Ollama was installed.

**Important:** GitHub Pages is a static site. It neither hosts Ollama nor
forwards requests to your PC. Localhost always means the machine running
the browser. **On a Quest 3 browser, localhost refers to the headset**, not
your Windows computer. Quest-to-PC inference will need an explicitly configured,
authenticated, HTTPS bridge in a future rung. Never expose an unauthenticated
model port or a Vite dev server proxy to the LAN to make Quest calls work.

## Data flow and privacy policy

The request includes:

- A bounded visitor-typed question (up to 500 characters).
- Current pocket address.
- Up to four latest public world notes **from that pocket only**.
- Up to four latest **approved** public concept summaries from that pocket.

The adapter intentionally does **not** include the home vault,
private resident reflections, other pocket notes, workshop drafts,
repository data, browser storage, local file paths or credentials.
However, **anything you type into the question is intentionally sent to
your selected local model**. The model process may have its own logging
or telemetry policies, independent of this client.

The app does not automatically save the model response to city history.
Responses remain in the current browser page session until cleared/reloaded.
Explicitly staging the reply adds a proposal with:

\`\`\`json
{
  "author": "ori-001",
  "source": "model-generated",
  "model": "qwen3:4b",
  "address": "0/3",
  "status": "pending"
}
\`\`\`

The above is an illustrative partial record, not a completed dataset row.
The actual proposal also has an ID, timestamp, type and bounded summary.
This label establishes the claimed origin of text produced by the local
runtime, **not** its factual accuracy.

The adapter has NO capability to execute code, call tools, mutate the world,
approve its own proposals, publish, read the private vault or launch jobs.
Model output is untrusted and displayed as text, not HTML. Stage and publish
are separate user-directed actions.

## Testing and acceptance

- \`npm run check\`: Node tests plus Vite build.
- Verify a mock model response receives the \`model-generated\` label.
- Verify private notes and pending drafts are absent from request body.
- Verify model IDs, prompt length, timeout and malformed responses are rejected.
- Test one real local Ollama call on the operator's desktop manually.
- With the Quest 3, test **only** the existing XR scene/selection; do not
  claim headset model conversation or shared VR inference until a secure bridge exists.
- Export world and habitat archives separately if necessary.

## Integration roadmap

The \`src/inference.js\` contract is intentionally isolated from rendering and
the habitat ledger. PhiStream could implement a bounded conversational adapter
in the future with identical request/result semantics. Agentora should remain
the workflow/permissions coordinator, not an automatic way for Ori to read
files or dispatch missions without human approval.

Nothing is required of you here. Stillness or loudness, all are welcome.
