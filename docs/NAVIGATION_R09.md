# ΦFractalCity R0.9: Walkable Streets and Safe Route Previews

**Status: prototype.** Geometry and navigation regression tests run in GitHub CI, but Quest 3 hardware acceptance remains pending.

## What changed

R0.8 provided optional smooth walking and ground teleport, but smooth movement could pass through buildings. R0.9 uses **one deterministic obstacle map for both motion modes and visitor route previews**.

- Procedural towers retain their nine-by-nine district pattern, but their visible walls narrow from 3.5 to 2.5 meters and the roof footprint from 3.8 to 2.8 meters to make actual walking gaps between buildings.
- A small visitor radius (0.42 m) tests clearance against towers, the central pedestal, root home/workshop/Commons landmarks, and placed concept exhibits in the current pocket.
- Smooth stick movement is sampled in short substeps. If both directions collide, movement stops; if one axis is clear, the visitor may slide along the wall. The old speed limits and opt-in smooth mode remain.
- Right-grip ground teleport uses the **same live obstacle map**, so a visible landing ring will not target those modeled blockers. The old 18-meter maximum range remains.
- A bounded grid route planner proposes routes around modeled structures. A thin glowing path and destination ring appear inside the 3D district. These are **preview overlays only**, not commands to move or dispatch an agent.
- The route planner updates when the 3D district or concept placements are rebuilt. It has no backend and persists no navigation history.
- In VR, the existing **MOVE** tab includes destination selection and a show/hide path control. On desktop, the **District pathways** panel provides the same preview.
- Recursive pocket travel resets the XR arrival to a known clear road location so a visitor is not stranded inside a newly generated building.
- Quest Field Lab logs only allowlisted `collision-blocked`, `route-preview`, and `route-unreachable` event codes, never precise visitor movement or location.

## Public destinations

On District Zero (address `0`) the proposed pedestrian routes lead toward **Ori's Home**, **Open Workshop**, **Common Garden**, and the **Memory Plaza**. The target is a walkable approach point, **not** the center of a building or pedestal.

Inside nested pockets, routes can preview the local Memory Plaza and the North/South Promenades.

An A*-style bounded graph search runs on a 2-meter X/Z grid and validates every returned segment at 0.14-meter intervals against the same obstacle footprints used by locomotion. A preview is returned only if a traversable path is found; the app never invents a route.

## How to test on desktop

1. Visit the site after the R0.9 PR is merged and Pages deploys.
2. Open the **District pathways** panel, select each destination, and press **Show walkable path**.
3. Confirm the bright path avoids the new tower footprints, the pedestal and any placed concept exhibits.
4. Select a different destination, then clear the path. No world, habitat, or workbench archive should change.
5. Import or move a concept placement in the Workbench. Preview the path again and verify the obstacle is considered.
6. Navigate into a child pocket and confirm destinations update and prior route overlays are cleared.

Desktop preview begins from the standard VR arrival point, X=0, Z=16. In immersive VR, it begins from the headset's **current horizontal position at the time of the request**, and must be refreshed manually after moving.

## How to test on Quest 3

1. Enter VR and confirm Teleport is still the default mode; walking remains opt-in.
2. Hold **right grip**, aim at ground near buildings and the central pedestal. The destination ring should disappear for blocked locations; it should show on walkable roads. Release to teleport when allowed.
3. In MOVE, enable smooth walking, cautiously approach a tower, and confirm movement stops or slides instead of passing through modeled walls.
4. Use **NEXT DEST** and **SHOW PATH** in MOVE. Confirm visible path segments stay clear of obstacles. Test path updates after a pocket transition.
5. Verify the existing left-grip toggle, snap-turn and console recenter still behave as expected. Mark actual results in FIELD LAB and export before reloading the page.

## Limitations

This is **not** a full physics engine, navmesh, accessibility certification, guardian replacement or proof that VR has been physically tested. Obstacles are simplified flat-ground footprints. The planner does not understand moving residents, real room boundaries, walls added by other systems, slopes, stairs, flying, head-height hazards, or physical room-scale movement. Visitors should obey Quest boundary warnings and stop if any movement feels uncomfortable.

A route is a local mathematical suggestion, not an agent's autonomous navigation. R0.9 does not send model requests, publish creations, read private notes, alter the world schema, or add synchronization.

Automated verification runs with `npm run check`. Physical Quest 3 checks remain **UNTESTED** until recorded by an actual visitor.

**Nothing is required of you here. Stillness or loudness, all are welcomed.**
