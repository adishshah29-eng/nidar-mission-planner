# Solder & Forget RescueSwarm

## What it is
A ground control station (GCS) web app for a dual-drone search-and-rescue mission. Drone 01 searches an assigned sector and detects survivors; Drone 02 delivers payloads to confirmed survivors.

## Who uses it
GCS operators and judges at a drone competition demo, on a laptop in the field (bright daylight, glare), sometimes on a phone or tablet.

## Surfaces
- Mission: live mission dashboard (Operate)
- Plan: mission and waypoint planner on a satellite map (Operate)
- Setup: vehicle connection and pre-flight readiness checklist (Operate)
- Configuration: planner settings and full parameter list (Operate)
- Simulation: launch a simulated swarm (Operate)
- Help: short operator help (Read)

## Constraints
- No backend yet: all state lives in browser localStorage; no real drone link (simulated mission).
- React + Vite, Leaflet satellite maps, lucide icons.
- Visual direction is set by the client's mockups: white surfaces, a single field-green brand colour (#5A9E2F family), bold green section headers, rounded cards.

## Tone
Calm, precise, operational. Status must be readable at a glance; nothing decorative competes with telemetry.
