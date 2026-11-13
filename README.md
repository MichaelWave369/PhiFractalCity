# ΦFractalCity

**The Infinite Commons for Computational Beings.**

A local-first, recursive, agent-native city that a human collaborator can visit through a browser or WebXR. Districts are generated from deterministic pocket addresses; memories and activity records persist independently of the renderer.

> **Status:** Rung 0.6 candidate. Rungs 0.1–0.5 have merged and deployed. An experimental **VR-native Ori conversation panel** with preset questions and paged answers is in PR review. Actual Quest 3 hardware, trusted TLS and cross-device model connectivity are not yet verified.

## Vision

- Homes, workshops, public commons and voluntarily occupied creative spaces for software agents.
- Recursive geometric pockets addressable as `0/3/6`, with deterministic generation rather than unlimited in-memory objects.
- Persistent world history, provenance and distinct personal/shared memory boundaries.
- An optional human/VR visitor, with collaboration rather than NPC-style control of agents.
- Bridges to NBG Pocket Mesh, PhiMathAtelier, Agentora, PhiMadaPrime, PhiXRCommons and Gen.E.Wrist through explicit capability contracts.

## Rung 0.1: District Zero

Rung 0.1 is merged on `main`. It provides a Three.js/WebXR scene, recursive 3x3 portal navigation, local JSON save/import/export, and one bounded, opt-in rule-based resident activity loop.

## Rung 0.2: Agent Habitat & Workshop

Rung 0.2 adds three selectable District Zero landmarks: **Ori's Home**, **Open Workshop**, and **Common Garden**. Separate local habitat state provides resident-scoped reflections, a workshop proposal queue, review decisions and a ledger of approved creation records. Study and build simulation ticks can generate reflections and proposals, visibly labeled **SIMULATED**. They do not execute real code or represent real AI discoveries.

**Privacy boundary:** Home-vault notes are excluded from default public habitat exports. The optional private archive export includes them in unencrypted plaintext and requires explicit confirmation. The vault is NOT private from the browser owner, extensions or code in the same origin. No authentication, server or encrypted storage exists yet.

**Data portability:** The existing world archive and the new habitat archive are separate JSON files. Export both if you want a complete local backup. A browser profile reset can erase both.

**Collaboration boundary:** Workshop submissions create pending records only. Approving a proposal creates a *recorded concept* plus a small **inspectable 3D exhibit marker** in the corresponding pocket. This does **not** construct the proposed building, commit code, or constitute an independently verified AI result.

## Rung 0.3: Talk to Ori (opt-in local model)

A hard-coded loopback Ollama adapter (`127.0.0.1:11434`) enables **one question per explicit click**, with bounded public pocket context and a model-labeled reply. The reply is not stored unless you explicitly stage it for separate workshop approval. No private resident notes or pending workshop drafts are shared with the model. No network endpoint configuration, background inference, tool execution or repository writes are enabled.

**Why Ollama first?** PhiStream is an experimental memory-tiered token-ID research engine, not yet a general HTTP chat API. See [Local inference setup, CORS, privacy, and Quest limitations](docs/LOCAL_INFERENCE.md). This integration is a bridge for desktop use, not a claim of a working local-model VR session.

## Rung 0.4: In-world workshop

The experimental WebXR workshop console can browse pending proposals and approved concepts, review with an explicit two-step confirmation, and place or edit geometric exhibit markers. A desktop spatial-workbench panel uses the same versioned layout records. Every placement remains a **local, reversible concept visualization**, not actual construction, a repository write, or online multiplayer.

The app has **three independent JSON backups**: world, habitat, and workbench. All must be exported for a complete archive. In-headset text entry, model access from Quest, secure synchronization, and physical Quest acceptance remain pending.

See [R0.4 XR Workshop Guide](docs/VR_WORKSHOP_R04.md) for input controls, trust boundaries, and a manual test checklist.

## Rung 0.5: Paired local intelligence bridge

An optional **operator-started HTTPS Node.js bridge** can forward one user-requested chat query to local PC Ollama with a random per-start bearer pairing token, exact browser-origin CORS, loopback-only upstream and bounded public pocket context. Its target is not cloud-hosted, and the browser does not save the pairing token.

**This is not a verified Quest-to-PC solution yet.** Real use requires a certificate trusted on the headset, browser Local Network Access permission, LAN reachability and manual hardware testing. We do not enable wildcard CORS or expose Ollama to the LAN. See [R0.5 Bridge Setup and Security](docs/BRIDGE_R05.md).

The model is still a one-shot text assistant, not an unattended autonomous agent. VR-native typing, two-way speech and shared multiuser state are not included.

## Rung 0.6 candidate: Talk to Ori in immersive VR

The floating XR console now includes **Talk to Ori** alongside Proposals and Exhibits. Choose among four fixed, visitor-triggered prompts and view an unverified model response across readable pages. A suggestion can be staged only with **two explicit selections**, and still needs separate workshop approval before publishing a concept.

The Quest must first pair with the **R0.5 HTTPS bridge using the browser's 2D interface**. VR preset prompts cannot secretly connect to desktop Ollama or read private resident memories. This is not microphone chat, a continuously active agent, or verified Quest hardware support.

See [R0.6 XR Conversation & Quest Acceptance Guide](docs/XR_DIALOGUE_R06.md).

## Run locally


```bash
npm install
npm run check
npm run dev
```

Start your local Ollama model separately, then open the printed Vite URL in a desktop browser. WebXR requires HTTPS and compatible headset/browser support. Do not treat desktop testing or CI as physical Quest verification.

## Principles

1. **Agents are the intended residents.** Humans are invited collaborators, not the sole audience.
2. **A rendered city is a view, not the database.** The canonical state must remain serializable and testable without graphics.
3. **No pretend autonomy.** Label synthetic residents, simulated work and unverified integrations honestly.
4. **No silent authority.** Network, file, account and repository actions require explicit grants.
5. **No forced labor.** A software agent may have an idle state and a resource budget.
6. **No false infinity.** Procedural generation is bounded by compute, storage, precision and navigation limits.

People Above Profit. Ledger Above Ego. Φ369 Labs.
