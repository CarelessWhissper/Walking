# track — Design Handoff

Ground-truth description of the **track** app as it exists in code today (2026-08-14).
Written for a design pass (UX/UI improvements). **Everything in this document is verified
against the source.** If something is not listed here, it does not exist in the app.

## Rules for the designer

1. **Do not invent functionality.** Propose visual/interaction improvements to what exists.
   The "Does NOT exist" section below is a hard boundary — designs must not depend on
   anything listed there (no settings screens, no accounts, no heart rate, etc.).
2. If an improvement genuinely requires *new* functionality, put it in a clearly separated
   "requires new functionality" list — do not mix it into the main proposals.
3. Stay within the existing design language (dark-only, cyan accent, thin tabular numerals,
   uppercase letter-spaced micro-labels) unless the proposal is explicitly a restyle.
4. The app is Android-first, sideloaded on a physical phone. No iOS-specific patterns.

---

## 1. What the app is

A single-user GPS **run tracker** built with Expo / React Native (Expo 54, RN 0.81,
expo-router v6). **All data is stored locally in AsyncStorage** — there is no backend, no
account, no sync, no social layer. Maps are MapLibre with CARTO's free dark-matter basemap
(vector, with a raster fallback), plus offline tile caching around the user's location.

- **Platform:** Android (physical phone, release APK). Dark UI only; status bar is always light-content.
- **Icons:** `MaterialCommunityIcons` from `@expo/vector-icons` — the only icon set used.
- **Fonts:** system font only. Hero numbers use ultra-light weights (200) with `tabular-nums`.

## 2. Navigation map

```
Root stack (dark theme)
├── (tabs)  — bottom tab bar, 3 tabs
│   ├── Track    (index)    icon: run
│   ├── History  (explore)  icon: history
│   └── Insights (stats)    icon: chart-box-outline
├── run/[id]   — run detail (pushed from History)
└── share      — share modal (slides up from Track or History)
```

Tab bar: 60px + safe-area, bg `#121214`, 1px top border, active tint cyan, 11px labels.
(`app/modal.tsx` also exists but is unused Expo-template leftover — ignore it.)

## 3. Screens, exactly as implemented

### 3.1 Track (home) — `app/(tabs)/index.tsx`

Layout, top to bottom:

1. **Map** (fixed 260px tall, bottom border): live user location with heading indicator,
   route drawn as a 4px cyan line, camera follows the user at zoom 16 while tracking.
   Overlaid pills: status pill top-right ("ready" / "recording" with dot, cyan tint while
   recording); offline pill top-left ("caching N%" while downloading tiles, "offline ready"
   once cached). Map failure → raster fallback → "Map unavailable" pill.
2. **Stats block** (fills remaining space): hero **duration** (60pt, weight 200) with
   "duration" label; secondary row **distance / pace / km/h** (22pt, divided by 1px rules);
   tertiary row of icon+value pairs: **cadence (spm), calories (kcal), steps** — each shows
   "—" until it has a value.
3. **Goal row** (one of three states):
   - No goal + idle → "Set goal" outline chip (flag icon).
   - Goal set + idle → cyan-tinted chip "Goal: …" with pencil icon; tap opens the editor.
     Chip icon varies: distance=flag, steps=walk, timed=timer.
   - Goal set + tracking → full-width progress bar (4px track) with "current / target" on
     the left and remaining on the right ("2.10 km left", or for timed goals
     "2.10 km in 12:34" counting down, then "… left · time's up", then "goal reached").
4. **Controls row**: one 72px round button — cyan **play** when idle, red **stop** while
   tracking. After a finished run two 48px side buttons appear: **reset** (refresh icon,
   left) and **share** (share icon, right).
5. **Error banner** (red-tinted) below controls when location tracking errors.

**Goal editor** — floating overlay near the top of the screen over a dimmed backdrop
(so the keyboard never covers it):
- Row of three type chips: **distance / steps / timed** (uppercase, icon + label, cyan
  tint when active). Switching type persists immediately.
- Input row: numeric text field + unit element + round confirm (✓) and clear (×) buttons.
  Distance & timed goals show a tappable **km/mi** toggle (converts the typed value);
  steps shows a static "steps" tag.
- Timed goals show a **second input row** below (timer icon) accepting minutes ("30") or
  clock time ("30:00", "1:05:00"). A timed goal = distance + time limit, both required.
- Inline validation errors in red below the editor ("Enter a positive number", etc.).
- Backdrop tap cancels. Saved to AsyncStorage keys: `targetMeters`, `targetSteps`,
  `targetTimeSeconds`, `goalType`, `distanceUnit`.

**Behavior facts:**
- Start/stop only — **there is no pause**. Stop immediately saves the run (if ≥10 GPS
  points) and shows a toast: "Run saved" or "New personal record(s)! …". There is **no
  post-run summary screen** — the screen just returns to idle with reset/share buttons.
- Tracking runs as an Android **foreground service**; the notification shows live
  "distance · time · pace". Runs survive backgrounding and even process kill (session
  restore on relaunch).
- Goal-reached / time's-up moments are announced **once per run via toast only**.
- First launch requests location permission; a denial shows a dedicated gate screen
  (marker-off icon, explainer, "Enable Location" button).
- On permission grant the app silently auto-downloads offline tiles (~2 km radius).

### 3.2 History — `app/(tabs)/explore.tsx`

- Header "History" (28pt bold).
- **Summary card**: runs count / total distance / avg pace / total kcal, divided columns.
  (Always computed over *all* runs — not the filtered period.)
- **Period filter pills**: week / month / all (all = default; active pill is solid cyan).
- **Run list** (cards): date ("Today"/"Yesterday"/"Aug 14") + time of day, share icon
  top-right; metrics row dist/time/pace; conditional extras row with kcal, spm, steps.
  - **Tap** card → run detail. **Long-press** → delete (confirm sheet: "Delete this run?",
    destructive red confirm, then "Run deleted" toast).
- Empty state: run-fast icon, "No runs yet / Your runs will appear here".
- All distances here are **km only** — the mi preference from Track is not applied.

### 3.3 Insights — `app/(tabs)/stats.tsx`

- Header "Insights".
- **Streak cards** (2-up): current day streak (fire icon, cyan) and longest streak
  (trophy). A streak survives if you ran yesterday but not yet today.
- **Personal Records grid** (5 cards, 3-per-row wrap): Fastest 1K / 5K / 10K (best
  contiguous split windows), Longest run (distance), Longest time. "—" when no data.
- **Activity heatmap**: GitHub-style, last 16 weeks × 7 days (Sun–Sat columns), cyan
  intensity by daily distance (0 / <2 km / <5 km / <10 km / 10 km+), with a less→more
  legend. Cells are **not tappable** and there are no day/month axis labels.
- Empty state: trophy icon, "No data yet".

### 3.4 Run detail — `app/run/[id].tsx`

- Header: back chevron + centered date ("Thursday, August 14, 2026") and time.
- **Route map card** (240px, rounded 16): static, non-interactive, bounds-fit to route,
  cyan route line. "No route recorded" fallback with marker-off icon.
- **Hero distance** (44pt weight 200) + label.
- **Stat grid** (3-per-row cards): Duration, Pace /km, and conditionally Calories,
  Cadence, Steps.
- **Splits section**: one row per km — km number, horizontal bar (length ∝ split time),
  pace right-aligned. Fastest split highlighted cyan. No other charts exist in the app.

### 3.5 Share — `app/share.tsx` (modal, slides from bottom)

- Header: close ×, "Share Activity".
- **Card carousel** (horizontal, paged, dot indicators — active dot stretches): 4 variants
  of a 400×711 (9:16) share card, order: **overlay** (minimal stats + SVG route trace),
  **dark** (gradient card), **map** (route-focused), **photo** (user photo background —
  a "Choose/Change photo" button appears for this variant; 9:16 crop via image picker).
- **Action row** ("SHARE TO"): Copy (clipboard image) / Save (media library) / Share
  (system share sheet), 56px round buttons, Share is the cyan primary. Buttons disable +
  show a spinner icon while busy; results are toasted.
- Cards are captured at 2× via view-shot. Cards always label distance in **kilometers**.

## 4. Shared UI components

- **Toast** (`components/Toast.tsx`): single toast at top, slides/fades in, auto-dismisses
  after 2.8 s, tap to dismiss. Variants: success (cyan check), error (red alert),
  info (white). Title + optional message. This is the app's only feedback mechanism.
- **ConfirmSheet** (`components/ConfirmSheet.tsx`): centered confirm dialog
  (fade+scale in), title/message/cancel/confirm, destructive style = red confirm.
  Used only for run deletion today.
- **ShareCard** (`components/ShareCard.tsx`): the four capture-only card layouts;
  route rendered as SVG path.

## 5. Design tokens (constants/theme.ts → `Theme`)

| Token | Value | Use |
|---|---|---|
| bg | `#121214` | screen background |
| surface | `#1C1C1F` | cards, pills, inputs |
| surfaceLight | `#242428` | nested/raised elements |
| border | `#2A2A2E` | 1px hairlines |
| text | `#F5F5F5` | primary text |
| textSecondary | `#909095` | secondary text |
| textMuted | `#5C5C61` | labels, placeholders |
| accent | `#00D9FF` | electric cyan — actions, highlights, route line |
| accentDim | `#00ACC1` | rarely used dim cyan |
| danger | `#FF5252` | stop button, errors, delete |
| dangerDim | `#D32F2F` | rarely used |

Recurring patterns: cyan tints as `rgba(0,217,255,0.08–0.25)` for active chips; radii
12–18 for cards/chips, full-round for buttons; 24px screen padding; micro-labels are
10–12px uppercase with 1–2 letter-spacing; all numerals `tabular-nums`.

## 6. Data model (AsyncStorage — the entire persistence layer)

- `runs`: array of `SavedRun` — id, ISO date, distance (m), duration (s), pace (m:ss/km
  string), calories?, cadence?, stepCount?, notes? (**never written or shown by any UI**),
  splits? (seconds per km), locations? (route downsampled to ≤400 points).
- Goal keys: `targetMeters`, `targetSteps`, `targetTimeSeconds`, `goalType`, `distanceUnit`.
- `userWeight`: **read** for calorie estimation (default 70 kg) but **no UI ever writes
  it** — there is no settings/profile screen.
- `activeRunSession`: crash-recovery snapshot of an in-progress run.

Derived data (computed, not stored): calories (MET-based from speed + weight), cadence &
steps (accelerometer peak detection), splits, PRs, streaks, heatmap.

## 7. Does NOT exist — hard boundaries

Do not design flows that assume any of these:

- **No settings, profile, or onboarding screens** of any kind (weight, units, and goal are
  the only preferences, and only goal/unit have UI).
- **No light mode** or theme switching — dark only.
- **No accounts, login, cloud sync, backup, or backend.** No social features: no friends,
  feeds, leaderboards, challenges, comments, or activity sharing beyond the image export.
- **No activity types besides running** — no walk/cycle/gym modes, no activity picker.
- **No pause/resume** during a run; no editing, renaming, annotating, or re-cropping runs.
- **No heart rate, no wearable/watch integration, no music controls, no audio cues or
  voice coaching, no interval workouts or training plans.**
- **No push/local notifications** beyond the tracking foreground-service notification and
  in-app toasts.
- **No GPX/CSV export or import**; sharing is image-only.
- **No charts** beyond the splits bars and heatmap (no pace graphs, trend lines, etc.).
- Elevation gain and GPS-accuracy grading exist as unused utility functions —
  **not surfaced anywhere in the UI**.
- Unit preference (km/mi) applies **only to the Track goal**; every other screen and the
  share cards are hard-coded metric.
- Installed-but-available libs if a proposal needs them: reanimated, gesture-handler,
  expo-haptics, linear-gradient, svg, expo-image. Nothing else may be assumed.

## 8. Known UX gaps — fair game for improvement proposals

These are observed weaknesses in the current implementation. Designing better treatments
for these (within existing functionality) is exactly what we want:

1. **Stopping is abrupt and risky.** One tap on the red button ends and saves the run —
   no confirmation, no hold-to-stop, no post-run summary moment. PR celebration is just a
   toast.
2. **Hidden destructive gesture.** Deleting a run is long-press only — no visible
   affordance.
3. **Unit inconsistency.** mi setting is honored only in the Track goal.
4. **History summary vs filter mismatch.** The summary card ignores the week/month filter,
   which reads as a bug.
5. **Heatmap is unlabeled** (no weekday/month markers) and non-interactive.
6. **Run cards are text-only** — the route data exists per-run and could be visualized
   (e.g. the SVG trace already built for share cards).
7. **Goal discoverability/feedback**: goal state is a small chip; timed-goal progress
   only shows while tracking.
8. **Dead space / no keep-awake consideration**: during a run the screen can sleep;
   glanceability of the stats layout at arm's length is untested.
9. **No start countdown or start feedback** (haptics are installed but unused).
10. **Empty states are static** — no guidance toward the primary action.
11. **`SavedRun.notes` field exists but has no UI** — smallest possible "new" surface if
    ever wanted (flag as requires-new-functionality anyway).
12. **Calorie accuracy is silently generic** — weight is always the 70 kg default since
    nothing can set `userWeight`; a weight input would require a new surface (flag it).

## 9. Deliverable expectations

For each proposal: which screen/section, what changes, why (tie to a gap above or a
heuristic), and how it uses existing data/tokens. Mockups should use the token table in
§5 and MaterialCommunityIcons names. Keep proposals grouped: **(a) pure UI polish,
(b) UX/interaction changes within existing functionality, (c) requires new functionality
(separate, clearly flagged).**
