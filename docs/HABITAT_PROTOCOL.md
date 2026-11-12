# ΦFractalCity Rung 0.2: Resident Habitat and Workshop Protocol

Status: prototype, local-only. No real agent inference, remote access, or multi-user authentication.

## Why the habitat is separate from the visual city

The city model \`src/world.js\` stores deterministic districts and public visitor markers.
The habitat model \`src/habitat.js\` stores resident metadata, locally scoped reflections,
creation proposals, human review decisions and a catalog of approved concept records.

The renderer is an observer and participant, **not** the source of truth.

## Permanent addresses

- \`0\`: District Zero, Ori's initial home district
- \`0/3/6\`: nested pocket example; deterministic from seed and address
- Three discoverable root landmarks:
  - **Ori's Home**: local resident reflections, not automatically shared
  - **Open Workshop**: explicit proposal and review lifecycle
  - **Common Garden**: shared gathering landmark (social simulation not yet built)

The landmarks render as selectable 3D geometry in District Zero.
Selecting them with a Quest controller is experimental and not yet verified on hardware.
The browser side panels provide the complete authoring and review controls.
Within WebXR, a controller select shows the currently selected zone on the world status board;
full in-headset forms and object collaboration are future milestones.

## Contracts

Habitat schema: \`phifractalcity.habitat.v1\`
Storage key: \`phifractalcity:habitat:v1\`
Resident: \`ori-001\` (\`rule-based-prototype\`).

All records have bounded lengths and capacities (80 notes, 80 proposals, 80 artifacts).
The model rejects malformed imports rather than executing any imported code.

Private memory example:

\`\`\`json
{
  "id": "n1",
  "owner": "ori-001",
  "source": "simulated",
  "address": "0",
  "text": "Simulated reflection 3: geometry observed in 0.",
  "time": "2026-11-12T17:00:00.000Z"
}
\`\`\`

A creation is a three-stage *record* operation:

1. **Propose** (pending): visitor-supplied or explicitly simulated Ori concept.
2. **Review**: an actual visitor approves or declines using the UI.
3. **Publish** (approved): creates a catalog artifact with the original source and proposal ID.

Publishing here does **not** create 3D geometry, edit the network, commit code, or run
a real model. No speculative agent event is presented as a verified discovery.

## Privacy and security boundaries

**Crucial:** "private" is a prototype *sharing intent* and export scope, not secure isolation.
The same browser origin holds the full local data; anyone or any script with access to that
profile/origin can inspect it. The optional private JSON backup is unencrypted.

- Public \`exportHabitat(habitat)\` omits all \`privateNotes\`; imported redacted exports
  legitimately have zero private notes.
- Explicit \`exportHabitat(habitat,{includePrivate:true})\` includes plaintext private notes.
- The app's own \`saveHabitat\` stores a full local copy for recovery. Without storage,
  it warns the user rather than claiming persistence.
- Public workshop proposals and published concepts are **not private**.
- Private reflections are never copied into public world events, workshop proposals,
  or default exports. They are not sent to any LLM or external service.
- Archive import is size-limited, schema-validated, confirmation-gated and local-only.
- World backups and habitat backups are separate files; export both to preserve everything.
- No automatic agent or human identity, true secure vault, server sync, or remote access exists.

## Compatibility

R0.1 world JSON and browser storage remain unchanged. Habitat is a new sidecar record
with a separate key. Users with existing worlds receive a default Ori habitat on first use;
their district address, public memories and world history are preserved.

## Manual acceptance matrix

1. Visit the Home, Workshop and Commons landmarks in desktop 3D.
2. Store a reflection; reload and verify it persists.
3. Export public habitat JSON and confirm the reflection is **absent**.
4. Explicitly export private JSON and confirm the reflection is **present**.
5. Submit a proposal; confirm no artifact exists before approval.
6. Approve and decline separate proposals; check the published artifact ledger.
7. Start Ori's build simulation; review an automatically generated proposal marked SIMULATED.
8. Verify malformed JSON imports are rejected and original state remains intact.
9. Test headset entry and controller targeting physically on Quest 3; log outcomes.
10. Run \`npm run check\` and confirm GitHub Actions passes.

## Integration roadmap

- R0.3: bounded Agentora/PhiStream adapter with separately granted action scopes
  and explicit read/redaction policy. No private-context transmission by default.
- R0.4: authenticated multiplayer and conflict-safe shared workshop synchronization.
- R0.5: headset-native workshop UI and Gen.E.Wrist WorldAdapter.

People Above Profit. Ledger Above Ego. Nothing is required of you here.
