# track — Design Pass (extracted from claude.ai/design, 2026-08-14)

Source: "Track Design Pass" — https://claude.ai/design/p/2f16a868-63d2-4149-a27a-48a1fbee2869
Status: Final. 21 proposals against the 12 known gaps in DESIGN-HANDOFF.md.
Implementation status: Parts A & B implemented in this repo; restyle and Part C not implemented (fenced).

## Part A — Pure UI polish (styling and layout only)

### A1 — Stats block that reads at arm's length (Track, gap 8)
Two-tier grid: duration and distance share the top tier at 52pt/weight 200 side by side;
pace and km/h drop to a 26pt pair; the derived trio (cadence, kcal, steps) becomes one 13pt
row with values in `text` and units in `textMuted`. Drop the vertical hairlines between live
numbers. Keep the em-dash placeholder, rendered in `textMuted`.
Why: two large numbers with clear labels beat one huge number plus a row of medium ones.

### A2 — Run cards carry their route (History, gap 6)
Reuse the share-card SVG route renderer at card scale: 56×56 trace on the leading edge of
each card, cyan at 1.5px on a `surfaceLight` tile. Cards without route data keep the tile
with a muted marker-off glyph (uniform row heights). Units move into a `textMuted` suffix so
the three numbers align as numbers; the extras row becomes one mono line rather than
icon+value pairs. Share icon becomes an overflow affordance (see B2).
Watch out: traces must be bounds-fit per run.

### A3 — Heatmap gets axes and a meaningful scale (Insights, gap 5)
Month initials above the first column of each month; weekday initials (M/W/F only) down the
left at 9px `textMuted`; legend states the buckets (rest, <2 km, <5, <10, 10 km+) instead of
less→more. Empty days get a 1px border outline rather than a filled square. Add period total
on the header row ("41 runs · 268.4 km") — already computed.

### A4 — One distance formatter, everywhere (all screens, gap 3)
Route every distance and pace string in History, Insights, run detail and the share cards
through one formatter reading `distanceUnit`. Pace labels follow ("5:16 /km" → "8:28 /mi").
Splits keep their unit in the section header so each row stays a bare number. No new
preference surface.

### A5 — Summary card states its period (History, gap 4)
Best fix: compute the summary over the filtered set and label it — filter pills move above
the card so cause precedes effect; card micro-label reads "this week · 6 runs". Column rules
dropped; the mono label carries the grouping.

### A6 — Empty states point at the action (gap 10)
History: "Your first run starts on the Track tab" + a ghost run card (dashed border, muted
placeholder numbers). Insights: "Records and streaks appear after your first run."
No cross-tab navigation implied — copy plus one dashed placeholder card.

### A7 — Records grid stops lying about emptiness (Insights, gap 10)
Full-width rows for the three split PRs (shared unit, invites comparison) and a 2-up pair
for longest run/time. Unearned cards state the condition in 9px `textMuted` — "run 5 km to
set this".

### A8 — Splits section reads as a chart (Run detail, gaps 6+8)
Anchor the bar scale to the run's own fastest and slowest split (±10% padding) so the shape
of the run appears. Fastest split cyan, rest `surfaceLight`. Range footer: "fastest 5:02 ·
slowest 5:41". (Partial-final-split hatching skipped: split times exist only for full km.)

## Part B — Interaction changes within existing functionality

### B1 — Hold to stop, then a summary moment (Track, gap 1)
Hold to stop: red button fills with a 900 ms ring while pressed; label switches to "hold";
light haptic at press, success haptic at commit; release early cancels silently.
Summary sheet: non-destructive post-run panel over dimmed Track screen — distance hero,
secondary stats, goal outcome if set, one cyan-tinted PR row per record ("previous 4:55"),
Share and Done actions. Replaces the "Run saved" toast. Keep a toast for the sub-10-point
case ("Too short to save"). Hold duration tunable in code; 900 ms recommended.

### B2 — Delete becomes visible (History, gap 2)
Card's top-right icon becomes an overflow (dots-horizontal) opening Share / Delete (red).
Swipe-left-to-reveal kept for speed; long-press stays for muscle memory. ConfirmSheet still
guards the destructive step.

### B3 — Goal is always visible, always progressing (Track, gap 7)
One rail in the same slot in all states: idle shows target with 0% track and an edit
affordance; tracking fills it; reached goal turns fill+label cyan and keeps counting. Timed
goals get a second thin marker line at the time-budget position ("am I ahead?" at a glance).

### B4 — Start feedback (gap 9)
3-2-1 countdown takes over the stats area (60pt weight 200), haptic tick per second and a
heavier one on "go", then reveal zeroed stats. Cancellable by tapping the button during the
count. Haptics also on: goal reached, PR earned, hold-to-stop commit, delete confirm.

### B5 — A run-mode layout for arm's length (Track, gap 8)
Map collapses from 260px to ~120px after 15 seconds of tracking (tap to restore); reclaimed
space goes to the numbers. Idle keeps today's proportions.

### B6 — Heatmap cells become a readout (Insights, gap 5)
Tapping a cell selects it (1px cyan outline) and writes its day into a fixed line under the
grid: "Tue 4 Aug · 8.05 km · 1 run". Tap the selected cell again to clear. Nothing navigates.

### B7 — Goal editor: fewer taps to the same result (gap 7)
(1) 3–4 quick-value chips per type derived from the user's own data (last goal, common
distance, last run's distance). (2) Inline validation against the field; disable confirm
rather than accept-then-error. (3) km/mi becomes a segmented control. Timed goals keep the
second row with a parse-rule hint ("30 = 30 min · 1:05:00 = 1 h 5 min").

### B8 — Permission gate earns the grant
State what location buys and what leaves the device: "Your route is stored on this phone
only. No account, no upload." When the system will no longer show the prompt, show a
different screen pointing at Android settings.

## Optional — restyle (NOT implemented)
Demote cyan to a single job (live data); warm off-white (#FAF7F2) for emphasis; chrome
warmer and darker (bg #0E0E10, surface #191919). Risk: less "sporty"; test side-by-side on
the phone before committing.

## Part C — Requires new functionality (NOT implemented)
- C1 Weight input (kcal accuracy) — small sheet from a "kcal · 70 kg" caption in Insights.
- C2 Run notes — field exists on SavedRun, no UI.
- C3 Keep-awake during a run — needs expo-keep-awake (not installed).
- C4 Surface elevation gain + GPS quality (computed, unused).
- C5 A real unit preference surface (settings sheet by another name). Flagged, not proposed.

## "If you only ship three"
1. B1 — hold to stop + summary (highest risk removed)
2. A2 — route traces on run cards (biggest visible change per hour)
3. A5 + A4 — honest periods and units (fixes a bug reading)
