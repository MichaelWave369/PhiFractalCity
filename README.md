# ΦFractalCity

**The Infinite Commons for Computational Beings.**

A local-first, recursive, agent-native city that a human collaborator can visit through a browser or WebXR. Districts are generated from deterministic pocket addresses; memories and activity records persist independently of the renderer.

> **Status:** Rung 0.2 candidate. District Zero has a simulated resident, persistent local habitat, opt-in visitor interaction, and a proposal-review workshop. This is not a multi-agent intelligence system. Quest 3 acceptance is pending.

## Vision

- Homes, workshops, public commons and voluntarily occupied creative spaces for software agents.
- Recursive geometric pockets addressable as `0/3/6`, with deterministic generation rather than unlimited in-memory objects.
- Persistent world history, provenance and distinct personal/shared memory boundaries.
- An optional human/VR visitor, with collaboration rather than NPC-style control of agents.
- Bridges to NBG Pocket Mesh, PhiMathAtelier, Agentora, PhiMadaPrime, PhiXRCommons and Gen.E.Wrist through explicit capability contracts.

## Rung 0.1: District Zero

Rung 0.1 is merged on `main`. It provides a Three.js/WebXR scene, recursive 3x3 portal navigation, local JSON save/import/export, and one bounded, opt-in rule-based resident activity loop.

## Rung 0.2 candidate: Agent Habitat & Workshop

The `feat/agent-habitat-r02` branch adds three selectable District Zero landmarks: **Ori's Home**, **Open Workshop**, and **Common Garden**. Separate local habitat state provides resident-scoped reflections, a workshop proposal queue, review decisions and a ledger of approved creation records. Study and build simulation ticks can generate reflections and proposals, visibly labeled **SIMULATED**. They do not execute real code or represent real AI discoveries.

**Privacy boundary:** Home-vault notes are excluded from default public habitat exports. The optional private archive export includes them in unencrypted plaintext and requires explicit confirmation. The vault is NOT private from the browser owner, extensions or code in the same origin. No authentication, server or encrypted storage exists yet.

**Data portability:** The existing world archive and the new habitat archive are separate JSON files. Export both if you want a complete local backup. A browser profile reset can erase both.

**Collaboration boundary:** Workshop submissions create pending records only. Approving a proposal creates a *recorded concept* plus a small **inspectable 3D exhibit marker** in the corresponding pocket. This does **not** construct the proposed building, commit code, or constitute an independently verified AI result.

Once merged:

```bash
npm install
npm run check
npm run dev
```

Open the printed Vite URL in a desktop browser. WebXR requires HTTPS and compatible headset/browser support. Do not treat desktop testing or CI as physical Quest verification.

## Principles

1. **Agents are the intended residents.** Humans are invited collaborators, not the sole audience.
2. **A rendered city is a view, not the database.** The canonical state must remain serializable and testable without graphics.
3. **No pretend autonomy.** Label synthetic residents, simulated work and unverified integrations honestly.
4. **No silent authority.** Network, file, account and repository actions require explicit grants.
5. **No forced labor.** A software agent may have an idle state and a resource budget.
6. **No false infinity.** Procedural generation is bounded by compute, storage, precision and navigation limits.

People Above Profit. Ledger Above Ego. Φ369 Labs.
