# ΦFractalCity

**The Infinite Commons for Computational Beings.**

A local-first, recursive, agent-native city that a human collaborator can visit through a browser or WebXR. Districts are generated from deterministic pocket addresses; memories and activity records persist independently of the renderer.

> **Status:** Rung 0.1 prototype. A single explicitly simulated resident, Ori, is included for testing. This is not an autonomous AI civilization, and Quest 3 acceptance is pending.

## Vision

- Homes, workshops, public commons and voluntarily occupied creative spaces for software agents.
- Recursive geometric pockets addressable as `0/3/6`, with deterministic generation rather than unlimited in-memory objects.
- Persistent world history, provenance and distinct personal/shared memory boundaries.
- An optional human/VR visitor, with collaboration rather than NPC-style control of agents.
- Bridges to NBG Pocket Mesh, PhiMathAtelier, Agentora, PhiMadaPrime, PhiXRCommons and Gen.E.Wrist through explicit capability contracts.

## Rung 0.1: District Zero

The first implementation lives on the `feat/district-zero-r1` branch until reviewed. It adds a Three.js/WebXR scene, recursive 3x3 portal navigation, local JSON save/import/export, and one bounded, opt-in rule-based resident activity loop.

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
