# District Zero architecture (R0.1)

## Truth boundaries

- `src/world.js` is the canonical world model: deterministic pocket addresses, building descriptors, notes, versioned JSON, and activity logs.
- `src/main.js` is a Three.js desktop/WebXR renderer and human visitor UI. No renderer data is required to restore a saved district.
- The root `0` has nine child pockets per level. Address depth is capped at eight (nine levels including root) in R0.1; no actual infinite storage or rendering is claimed.
- A limited Mandelbrot escape-time sample adds architectural variation. It is not scientific geometry or a mathematically exact Mandelbrot flythrough.
- Ori is an **opt-in rule-based simulation**. Its activity runs only while the page is open. It has no model, long-running worker, file access, repository authority, or network API.
- Memory is local browser storage, with explicit JSON import/export. This is not distributed persistence or secure authentication.

## Rungs

R0.1: deterministic 3D pocket districts; local memory and explicit simulated resident; WebXR entry (unverified on physical Quest).
R0.2: portable Agent/World/Memory v1 contracts; per-agent private memory vaults, permissions, provenance and reproducible replay.
R0.3: opt-in adapter to Agentora/PhiStream with explicit human-approved capabilities and event validation.
R0.4: multiplayer and synchronized co-authoring, authenticated admission, durable backend and conflict resolution.
R0.5: Quest 3 interaction QA, Gen.E.Wrist WorldAdapter and PhiXRCommons bridge.
R1+: agent-native homes, workshops, Commons, self-directed schedules and resources with honest state and capacity limits.

## Intended integration boundaries

| System | Future integration |
| --- | --- |
| Agentora | agent lifecycle orchestration; no implicit dispatch |
| PhiStream | bounded inference; no hidden model claims |
| PhiXRCommons | shared world transport with authenticated users |
| Gen.E.Wrist | consented location/actions WorldAdapter |
| PhiMadaPrime | optional workshop and repo status views, no write authority |
| PhiMathAtelier / NBG | new procedural geometry palettes, not data storage by themselves |

## Acceptance

- Run `npm run test` and `npm run build`.
- In browser: enter pockets, return home, store a note, reload, export, import and reset.
- In Quest 3: verify entering/exiting VR, controller target picking, motion comfort, persistence and session recovery. No physical Quest test has yet been performed.
