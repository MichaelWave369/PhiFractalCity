# ΦFractalCity R0.4: Spatial Workshop and Experimental XR Console

## Status

Rung 0.4 is a **local-first browser/WebXR candidate**. The underlying desktop
placement editor and the in-headset controller panel share the same local data.
Physical Quest 3 testing has **not** been performed or independently verified.
Do not call this a multiplayer city, headset microphone chat, a mature VR UI,
or a secure live model connection.

The preceding GitHub Pages workflow was fixed in PR #4. The Pages deploy for
that merged commit succeeded. This rung remains a separate PR until merged.

## What exists

- An XR console drawn as a floating panel relative to the visitor rig.
- In immersive WebXR, **left controller grip** toggles panel visibility.
- Controller trigger/raycast selection can switch between pending proposals
  and approved concepts.
- Approve, decline, and remove actions require **two matching selections
  within 10 seconds** for the same object and pocket. This is only an
  accident-prevention UI confirmation, not authentication.
- Approved workshop concepts can be placed as editable primitive exhibits.
  A placed exhibit can move one grid step, rotate 45 degrees, or be removed.
- A desktop sidebar mirrors the concept layout editor so the data path can
  be tested without a headset.
- Each layout belongs to a deterministic pocket address; unlinked placements
  remain in imported/exported layout JSON instead of being silently discarded.
- All changes are local browser storage. The original world and habitat
  schemas are unchanged.

## Operation on desktop

1. Create a proposal in **Open Workshop** and approve it.
2. Scroll to **Spatial workbench** and select its approved concept.
3. Press **Place selected concept**. A geometric exhibit appears in that
   pocket; select the shape in the 3D view or its ID in the sidebar.
4. Use arrow controls to move it, **Rotate 45°** to turn it,
   and **Remove (confirm)** to delete only the placement.
5. Reload: the exhibit should remain. Export **layout JSON** for a backup.
   The underlying approved proposal survives removing the placement.

## Experimental Quest workflow

1. Open the HTTPS GitHub Pages site from the Quest browser.
2. Enter immersive VR, and try the floating console.
3. Point a controller ray at a tab or button and use the trigger.
4. **PROPOSALS**: move between current-pocket pending concepts,
   read model/simulation/visitor origin, press APPROVE or DECLINE
   **twice** to review.
5. **EXHIBITS**: browse published concepts, PLACE an exhibit, then aim at
   that placed exhibit to select it. MOVE, ROTATE or REMOVE from the
   panel. REMOVE requires two selections.
6. Press the **left grip** to hide/show the console. Exiting VR
   hides it. Check comfort and UI readability in the actual headset.

The XR console currently includes **no native text keyboard** or voice
transcription. A new proposal must be created on desktop or the ordinary
web interface; headset-native editing and audio require later work. A
model accessible via loopback on your PC does **not** become accessible
from a Quest by this change. This is a single-browser session, not
synchronized multiplayer or remote control.

## Data and trust boundaries

Rung 0.4 adds `phifractalcity.workbench.v1` with a separate storage key.
Records contain placement ID, approved concept ID, pocket address, integer
X/Z and eighth-turn yaw, creation time. There is a strict limit of 60
placements and a bounded ±36 coordinate grid.

No model-generated text automatically places objects. Proposals still
require manual approval. No private vault data is shown on the XR console
or added to public exports by the workbench. Model suggestions retain
their original source label in the published concept ledger.

All imported layout JSON must pass schema and bounds validation. Import
replaces only the local layout **after confirmation**, not the world or
habitat. A layout may reference an artifact absent from an imported
habitat: those orphaned placements are retained in storage/export,
but not drawn until the referenced approved artifact is available again.

**Backups require three separate archives:** world JSON, public or explicit
private habitat JSON, and workbench layout JSON. No cloud sync, backend
identity, encrypted persistence, conflict resolution, or authenticated
multiuser authority is included.

## Automated acceptance

- `npm run check` runs deterministic world, habitat, inference,
  workbench and two-step XR review-gate tests plus the Vite build.
- CI validates the code bundle, not the physical WebXR interaction.
- A UI smoke test should verify that the scene loads, buttons can
  select/edit a placement, state survives reload, imports are bounded,
  and staged proposals stay pending until review.

## Manual acceptance needed

- Quest 3: verify console visibility, left grip toggle and trigger
  raycasting; check text size and panel distance.
- Test parent/child pocket travel while the VR console is open.
- Confirm two-step approval and decline cannot leak across proposal
  selection or pocket changes.
- Ensure unexpected controller disconnects/exits preserve the saved
  desktop layout without duplicate placements or unintended review.

## Next steps

R0.5: secure, opt-in, explicitly paired Quest-to-PC inference bridge
with authenticated HTTPS and origin policy, plus headset-native
conversation controls. This bridge must never expose the unauthenticated
Ollama service directly on the LAN. No such bridge exists in R0.4.

R0.6+: realtime co-presence and synchronized collaboration, with
explicit user/agent identity, event histories, reconciliation and
conflict resolution.

Nothing is required of you here.
