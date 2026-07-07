---
name: wsp-enrollment-pacing
description: This skill should be used when the user asks to "fix the pacing chart", "the enrollment numbers look wrong", "the cohort comparison is off", "% complete is showing an impossible number", "the forecast line is flat", "add the new cohort to the pacing sheet reader", or reports any bug on the /enrollment, /pulse, or cohort-comparison surfaces of the WSP Analytics Hub. Applies to any change touching src/lib/sheets.ts, src/lib/pulseLive.ts, or src/app/api/enrollment/route.ts.
---

# Diagnosing and fixing enrollment-pacing bugs

This file's git history is a string of one-at-a-time fixes (wrong column, conflated metrics, same-day comparison, one-day lag, timezone boundary). They are all instances of five root causes. Internalize the root causes and the diagnostic order; don't just patch the symptom.

## The five root causes behind every bug in this file

1. **Positional coupling to a human-restructured sheet.** `COL`/`V2` hardcode 0-based column indices, but the sheet owner inserts a column every cohort rotation, shifting everything rightward. The comment at the top of `COL` — "Positions are stable across cohort cycles — only the column headers change" — is **precisely backwards**: the headers are the stable semantic anchor; the positions are what shift. The `wForecastIsReal` guard exists because col 25 silently changed meaning from "Spring '26 - forecast" to "Fall '26 - actual"; note that guard is *reactive* — only the one column that already burned us gets header verification, and the other ~20 indices are still trusted blindly.
2. **Semantically adjacent metrics that numerically coincide.** Enrolled, goal, model forecast, goal-pace, and each cohort's own eventual final all sit within ~15% of each other. Worse, recorded "goals" in `W_GOALS` are often backfilled to equal the actual final, so "% of goal" and "% complete" *coincide on most historical test data* — which is exactly how the conflation bug shipped. The `forecast` output field is overloaded three ways (V1 model forecast, goal backfill for completed cohorts, goal-pace in V2). Picking the wrong sibling produces a plausible-looking number.
3. **Time-axis misalignment.** Three shipped sub-failures: comparing an in-progress cohort to historical *finals* instead of same-days-remaining values (fixed via `findRowAtDay`/`findHistEntriesAtDay`); the one-day data lag ("enrolled as of today" is yesterday's close, so pace compares against *yesterday's* forecast row); and business-day boundary in server-local time vs. Eastern. A shared ET helper exists — `nowET()` in `src/lib/cohortCalendar.ts`, used by `pulseLive.ts` — but `getPacingDataV2` doesn't use it: its `todayMs` is server-local `new Date().setHours(0,0,0,0)`, so timezone fixes don't propagate on their own. Check every place "now" is computed whenever touching date logic.
4. **Silent fallbacks convert structural failure into confident wrong numbers.** `?? 1225`, `?? 485`, `?? 0` everywhere; `fetchHistoricalWhartonMap`'s bare `catch { return new Map(); }` silently degrades the V2 comparison panel to hardcoded finals (`883/1020/1003`, `pctComplete: 100`); `N()` nulls `#DIV/0!` and then `?? 0` renders a sheet formula error as "zero enrollments." Nothing distinguishes "the sheet changed shape" from "enrollment is zero." Never let a structural mismatch degrade into a default value.
5. **Five parallel implementations drift independently.** V1 `getPacingData`, V2 `getPacingDataV2`, the mock builder in `route.ts` (second copy of `buildPanel`), `getDemoPacing`, and `pulseLive.ts`. V1 and V2 deliberately disagree about col 24 (V1 treats it active, `fetchHistoricalWhartonMap` treats it historical). Cohort-rotation day requires manually editing `histCols`, `W_GOALS`/`C_GOALS`, and `COL` together — the comments say so, and forgetting one is a standing bug source.

## Diagnostic sequence for a reported wrong number

Ordered cheapest-check-that-discriminates-the-biggest-bug-class first:

0. **Confirm real data** (30s): `isDemo()` off, API response lacks `mock: true`. People have debugged demo data before.
1. **Which code path?** The `cohort` query param routes between V1 and V2. Within V2, `pctComplete` comes from the V1 historical map *or* the hardcoded fallback (check `last3AtDay.length === 3`; if the V1 fetch threw in the bare catch, you're in fallback and the bug is upstream of where the symptom points). Also confirm which UI column binds `pctComplete` vs `pctOfGoal` — these have been crossed before.
2. **Dump the raw sheet grid before reading code.** Fetch `'Overall Cohort - AN Summary'!A1:AH200` and read the actual header row. Verify cols 18–25 and 28–32 by header text, not by faith — column insertion is the single most frequent historical cause.
3. **Verify the denominator.** `getPacingData` computes `wOwnFinals` from `dataRows[0]` *assuming* the first row under the header is day 0; `fetchHistoricalWhartonMap` correctly does `find(r => Number(r[0]) === 0)`. A spacer row makes `dataRows[0]` a mid-cohort snapshot → ownFinal too small → pct > 100. (A "140% complete" symptom means numerator and denominator come from different cohorts/columns, or the denominator isn't a final — pctComplete is ≤100 by construction for a cumulative series.)
4. **Check label joins.** `normLabel` strips program prefixes; both programs have a "Winter '26" with ~2x different goals, so a CBSEE "Winter '26" label through `getWGoal` returns the Wharton goal (wrong program, no error), while a reworded header ("Winter 2026") nulls the lookup → goal 0.
5. **Check day alignment.** `findRowAtDay`/`findHistEntriesAtDay` have **no max-distance guard** — a sparse map means "nearest day" can be arbitrarily far from target. And check today/yesterday resolution at the timezone boundary.
6. Only now read for a logic bug, recomputing one row by hand against the raw grid.

## Invariants to verify before calling any fix "done"

Each would have caught a shipped historical bug:

1. **Header assertion for every column index you read** (generalize `wForecastIsReal`): assert the header cell contains the expected keyword; fail loudly on mismatch.
2. **`pctComplete` ∈ (0, 100], nondecreasing as day→0, exactly 100 at day 0** for every historical series. Instantly catches wrong-denominator, wrong-column, and the %-of-goal conflation (a %-of-goal series ends ≠100 for any cohort that missed goal).
3. **Same-day assertion**: historical entries used in a comparison panel must come from a row with |day − daysRemaining| ≤ 2.
4. **Time-boundary test at both edges**: mock 7:59pm and 8:01pm ET with TZ=UTC; assert same business day and that `yesterdayRow` is exactly one sheet row before `todayRow`.
5. **Cross-metric self-consistency**: recompute `pctOfGoal` from `enrolled/goal` independently; `summary.enrolled` must equal `wActual` at the pacing point nearest `daysRemaining`; `last3Avg` must equal the mean of `closedRows`.
6. **Exercise the fallbacks deliberately**: break the V1 sheet ID and look at what the bare catch degrades to; run once with no creds to confirm you didn't validate mock data.
7. **Grep the raw grid for your output numbers**: every headline number returned should appear literally in the fetched range or be recomputable in one step from cells that do. A displayed number that exists nowhere in the sheet means you read the wrong cell — this one check catches almost the entire bug class.

## The most dangerous assumption

Trusting an index without verifying the header text at that index in the same request. A shifted index doesn't throw and doesn't return garbage — it returns the *adjacent cohort's* smooth cumulative curve, which is type-correct, unit-correct, and passes every visual check. The failure mode isn't an error; it's a dashboard that looks fine and is wrong.
