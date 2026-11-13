# ΦFractalCity R0.6: VR Conversations with Ori

**Status:** experimental browser WebXR UI. Code and tests are not a substitute for physical Quest 3 validation.

## Goal

Speak with the city's *model-backed text interface* without leaving immersive VR. R0.6 deliberately starts with four fixed on-screen prompts and paginated model responses, rather than claiming voice transcription, freeform speech, persistent model autonomy, or independent agent action.

## The operator flow

1. On the Windows PC, start Ollama and the operator-started authenticated HTTPS LAN bridge described in [R0.5 setup](BRIDGE_R05.md). It must have a certificate trusted by the Quest, correct allowed GitHub Pages origin, restricted LAN firewall permission and a valid model installed.
2. In the Quest browser's **2D page**, select **Paired HTTPS LAN bridge**, enter the bridge URL and temporary pairing token, and choose the installed model. The token remains in this page session only. **Do not open Ollama's port to the LAN.**
3. Enter VR. The floating console is visible; the left grip toggles it. Select the new **TALK TO ORI** tab with a controller ray and trigger.
4. Select a prompt using **PREV QUESTION** / **NEXT QUESTION**. Prompts cover welcoming, geometric inquiry, community participation, and workshop ideas.
5. Press **ASK ORI**. This is the sole action that initiates a request. The request carries only the visitor-selected fixed prompt plus the currently visited pocket's bounded public notes and approved concepts. Private home memories and pending drafts are not sent.
6. When a model response arrives, the panel shows an **unverified** answer in readable pages. Use **PREV PAGE** / **NEXT PAGE** to move between pages.
7. If you want to keep a suggestion, select **STAGE IDEA** twice within ten seconds. It enters the *pending* workshop ledger with the model ID and original pocket address. Staging is not publishing. The separate two-click **APPROVE** review in the PROPOSALS tab is still required before a 3D exhibit concept appears.

## Explicit safeguards

- No requests on page load, session start, portal travel, object selection, or model response. Every model request starts with a visitor selecting Ask.
- No browser microphone, hidden speech recording, speech recognition, text-to-speech, or automatically executed model commands.
- The model's response is never rendered as HTML or evaluated as code. Text output is limited to 900 characters and paged.
- The data sent to the bridge is the current public pocket context as defined in src/inference.js; private vault entries and workshop drafts remain excluded.
- Model responses are ephemeral in the open page and are not saved until you deliberately stage an idea. The pairing secret is not stored in any world archive.
- Any failed network/certificate/pairing request shows an error message instead of inventing a response.
- The headset's localhost is not the PC's localhost. VR mode deliberately requires the previously selected **paired bridge** transport.
- R0.5 transport security is a prototype; do not expose the bridge or Ollama beyond your trusted LAN or assume browser-origin pairing proves a user's identity.

## Acceptance steps

1. Run `npm run check` and confirm the R0.6 prompt, pagination, privacy, and XR confirmation tests pass alongside existing tests.
2. On desktop, verify ordinary typed prompts still work, model provenance is retained, and stage/review functions are unchanged.
3. On physical Quest 3, confirm the new third tab renders, the headset controller can select all four prompts, and left grip toggle still works.
4. Verify **ASK ORI** cannot issue a query until a trusted PC bridge has been paired in the 2D interface. Test absent, wrong, and expired token behavior.
5. Verify a successful answer is paginated, not silently truncated, and its model and pocket attribution are correct.
6. Verify two selections are necessary to stage an idea; a separate review is necessary to publish an exhibit.
7. Travel to a different pocket while a model request is pending and verify the response/proposal remains tagged with the original pocket.
8. Confirm no private vault entry or pending draft appears in any outgoing model request.

## Next rung

Optional **push-to-talk** requires explicit microphone permission, input indicators, local speech recognition support and a comparable privacy review. Independent model workers and multiplayer state are separate future milestones.

**Nothing is required of you here. Stillness or loudness, all are welcome.**