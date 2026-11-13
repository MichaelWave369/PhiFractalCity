# ΦFractalCity Rung 0.8 · Quest Comfort and Visitor Locomotion

**Status:** experimental WebXR controls awaiting on-device Quest 3 acceptance. CI cannot verify controller mappings, comfort, guardian boundaries, or physical motion safety.

## What changed

- New **Quest comfort** sidebar and **MOVE** tab in the WebXR console.
- Default **teleport-only** locomotion instead of always-on thumbstick walking.
- Right grip: hold to aim at clear ground within the district, release to move. A visible ground ring shows a valid destination. No movement occurs for out-of-range or building-intersecting targets.
- Right thumbstick: configurable snap turn at 30° or 45°, or disabled. A release latch prevents continuous spinning from one held input.
- Left thumbstick: smooth walking **only when the visitor opts in**, with selectable bounded speeds of 1.5, 2.5 or 3.5 meters/second.
- Left grip: hide/show the in-world console. Reopening it docks the panel in front of the current headset position. The MOVE tab has a separate **RECENTER** button.
- Select the panel's distance (1.4, 1.8 or 2.2 meters). It is docked on request rather than forcibly glued to head direction on every frame.
- Preferences are in a separate local browser key, `phifractalcity:xr-comfort:v1`, **not** in the city, agent memory, workshop, pairing token or existing JSON exports.
- Quest Field Lab can record allowed event **codes** for teleport aim, completed teleport and snap turn, never raw controller coordinates or personal data.

## Starting experience in Quest

1. Open the deployed GitHub Pages site in Quest Browser and press Enter VR.
2. Your existing world still opens at District Zero with the console visible.
3. Teleport mode is the initial default. Hold the **right grip**, tilt the controller toward a clear road or plaza area. A cyan ring indicates a permitted landing. **Release the grip** to teleport. No ring means no teleport.
4. Push right stick decisively left or right and release it before snapping again. Default is 45°; the MOVE tab can select 30° or Off.
5. Open the **MOVE** tab to enable smooth left-stick walking, adjust speed, change panel distance or recenter the floating panel.
6. Left grip hides/shows the console. The visitor may also physically turn in room-scale VR.
7. If motion causes nausea or discomfort, stop moving, return to Teleport mode, disable snap turning if preferred, or exit VR.

## Ground targeting limitations

Teleport landing is calculated by a downward controller ray intersecting the flat district ground plane at Y=0. It is limited to an 18-meter horizontal radius and district X/Z coordinates within ±44 meters. Bounding boxes approximate the deterministic building footprints and reject landing inside them. There is **no full collision physics, guardian system integration, stair navigation, elevated walkway teleport, or continuous swept-body collision** in R0.8. Smooth walking can still visually pass through structures, so it should be treated as exploratory until collision handling exists.

Controller hand assignment uses WebXR `XRInputSource.handedness` rather than assuming a particular index is the left hand. The headset must expose `squeezestart`/`squeezeend` events and the expected axes for this hardware route; physical Quest testing remains necessary.

## Console behavior

The console stays at its docked location relative to the visitor's rig instead of continuously following every head movement. This reduces the sensation of a panel stuck to your face. Reopen with left grip, or press RECENTER in the MOVE tab, to dock it roughly in front of the current head direction. The panel distance preference affects the next dock. These positions are estimates and need headset readability/comfort QA.

## Testing

- Automated tests check stored preference validation and round-trip, thumbstick deadzone, snap-turn latching, bounded smooth movement, and teleport destination rejection.
- Existing world/habitat/workbench schemas remain unchanged; prior JSON archives remain importable.
- The Quest Field Lab checklist still begins **untested**, regardless of CI status.
- On the actual Quest: check right/left handedness events, grip release behavior, marker visibility, snap-turn direction, recenter placement, collision and comfort. Record failures in the Field Lab and export its report.
- Test physical guardian boundaries and tracking changes manually. The app does not implement headset safety controls.

**Nothing is required of you here. Stillness or loudness, all are welcomed.**