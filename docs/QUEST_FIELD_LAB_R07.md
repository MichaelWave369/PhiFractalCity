# ΦFractalCity R0.7 · Quest Field Lab

**Status:** instrumentation and manual-acceptance workflow. This feature **does not** establish that the city has been physically verified on Quest 3.

## Why this rung exists

A green CI build proves our code compiles and the automated invariants pass. It does not prove controller rays align with the VR console, the left grip works, the UI is legible at headset resolution, locomotion is comfortable, or the PC bridge has a trusted TLS certificate. Field Lab helps an actual visitor document those observations without sharing account secrets, private resident memories, or inference content.

## In the Quest

1. Visit the deployed HTTPS PhiFractalCity page in Quest Browser.
2. Enter VR. The console has **FIELD LAB** as its fourth tab. The left grip can toggle console visibility.
3. Use **PREV TEST** and **NEXT TEST** to browse eight manual checks. Point and trigger to mark **PASS**, **FAIL**, or **SKIP**. No result is marked automatically.
4. The panel shows the number of VR sessions, total allowed diagnostic events, and recent JS frame timing statistics. These are not compositor frame metrics or a full telemetry benchmark.
5. For conversations, pair the R0.5 bridge separately through the normal 2D browser panel; do not expect Field Lab to configure TLS or grant Quest network permissions automatically.
6. Exit VR. Scroll to the **Field Lab** panel in the desktop/2D page and choose **Export QA JSON**. The report is a local browser download and can be shared intentionally. Nothing is uploaded by Field Lab.

**Important:** A page reload discards QA test marks and sampled metrics. Export before reload or exiting the page. World, habitat and workbench saves remain independent and unchanged.

## Eight checks to perform

| Check | What the visitor verifies |
| --- | --- |
| Entry & exit | VR enters and exits cleanly, browser UI still works |
| Controller ray | Trigger selects the intended button without accidental hits |
| Left grip | Console toggles hide/show reliably |
| Pocket travel | Portal navigation works; parent/district return remains usable |
| Workshop | Proposals and exhibits can be browsed and reviewed without unintended approval |
| Ori conversation | Fixed prompts show a real reply **or** a clear pairing/network error |
| Reload persistence | World, habitat and layout state survive a *real* reload |
| Comfort | Text size, position, motion and controls are comfortable in the headset |

A separate **Test browser storage** button makes a temporary write/read/remove to verify localStorage access in the moment. That single probe **does not count as proof** of full persistence across reload or devices.

## What is recorded

A bounded, session-only state contains:

- Start and export timestamps.
- Count of VR sessions and allowed event codes (entry, exit, select, left grip, console toggle, portal travel, panel action, model attempt/success/failure, and explicit storage-test outcomes).
- Up to 80 latest event code/timestamp records; no action payloads.
- Up to 240 recent JavaScript frame-interval samples used to compute approximate mean and p95.
- Eight user-selected manual checklist statuses (untested, pass, fail or skip).

The report is **allowlist-serialized**. It never includes arbitrary event metadata, agent conversation text, bridge URL, pairing token, model ID, browser fingerprint, user agent, location, home-vault notes, or full world state. It is not sent to any server. A timestamp can still reveal when a test occurred, so share exported reports only when you choose.

The frame estimate uses the JS animation loop and can be influenced by garbage collection, background activity, and browser scheduling. **It is not Quest compositor FPS, frame timing telemetry or a comfort certification.**

## Troubleshooting and acceptance

- If VR never starts, record entry as FAIL using the 2D panel. Check browser/WebXR availability and headset updates.
- If the controller ray is offset or buttons are missed, note FAIL for pointing, then export the report. Device recording and screenshots can help, but no screen capture is automatically collected.
- If the console cannot be opened, record FAIL for grip via the 2D panel after exiting VR.
- If Ori gives a bridge error, mark dialogue FAIL only if the behavior is unexpected; a clear error when no bridge is paired is expected.
- To verify persistence, export your world/habitat/workbench archives first; leave a small test object, reload, and confirm the object remains. This check must be marked manually.
- After export, attach the JSON to a GitHub issue or PR if you choose. No automatic upload or account connection exists.
- Revisit the eight manual checks after each major UX change before treating the VR route as hardware-accepted.

## Development verification

Run `npm run check`. This exercises event allowlisting, statistics, bounded buffers, manual outcomes, redacted export, and existing world/bridge/XR policy tests, plus the Vite production build.

The feature is **local-only** and **single-page**. It is neither an external monitoring platform nor autonomous agent telemetry.

**Nothing is required of you here.**
