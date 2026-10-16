# Langkah: original feature plan

Status: the plan written before the build (2026-10-15). What exists now is in the [README](../README.md); who does what is in [tasks.md](tasks.md).

Entry for the AI Builders Cup (Google Cloud): an AI rehab coach for people after limb amputation, used at home between clinic visits. **Web app, no avatar.** Real-time voice, exercise logging and the care-team loop (rehab doctor + physiotherapist) matter; a talking face does not.

## Principles

- **Close the loop first, add AI after.** Phase 1 is a usable product with one AI feature (the voice coach). Everything else waits until the care team and a patient can go round the loop end to end.
- **The care team owns the plan.** The physiotherapist sets the exercises; the rehab doctor sets the clinical limits. The AI explains, counts, encourages and logs. It never changes the exercises, intensity or schedule, and never diagnoses.
- **Next actions are rules, not model output.** Pain thresholds, missed sessions and review dates are checked in code, so behaviour is predictable and explainable to judges and clinicians.
- **The log is the source of truth.** The coach proposes counts; the patient confirms them on screen.

## The core loop

```
Physio prescribes plan ──► Patient gets schedule ──► Reminder fires
(within doctor's limits)                                   │
        ▲                                                  ▼
Care team reviews, physio re-prescribes   Voice-coached session (patient counts aloud)
        ▲                                                  │
        │                                                  ▼
Check-in visit ◄── Next action (keep going / contact clinic / book check-in) ◄── Session logged
```

## Phase 1: core loop

Goal: a physiotherapist, a rehab doctor and a patient, on three browser windows, go round the full loop in under five minutes during the demo.

### Care team (web, desktop first)

Each patient has a care team of one rehab doctor (in Indonesia usually a Sp.KFR) and one physiotherapist. Both see the same dashboard; what they can change differs.

| | Rehab doctor | Physiotherapist |
|---|---|---|
| Adds the patient, sets diagnosis details | Amputation level and side, rehab stage (pre-prosthetic / prosthetic), restrictions ("no weight bearing on left") | — |
| Clinical limits | **Pain threshold**, **review date**, can pause the programme | — |
| Exercise plan | Can view; approves if the clinic wants that | **Builds and progresses it**: exercises, sets, reps, hold, notes, schedule |
| Alerts | Urgent and high (pain, wounds, falls) | Everything; handles adherence and difficulty |
| Check-ins | Doctor review visit (e.g. every 2–4 weeks): visit note, new limits | Therapy session: visit note, new plan version |

1. **Patients:** the doctor (or the physio, for a demo) adds a patient and gets an invite link to send by WhatsApp.
2. **Prescribe:** the physio picks exercises from the library within the doctor's restrictions and sets the schedule (days and time of day).
3. **Dashboard:** patient list sorted by open alerts, then by review date. Per patient: adherence (done / scheduled), pain before/after chart, session log, concerns, check-in requests.
4. **Check-in:** open the patient, read the summary, write a visit note, resolve alerts, then the physio saves a **new plan version** (copied from the previous one) and the doctor sets the next review date. The patient sees the new plan on their next visit to the app.

### Patient (web, phone first)

1. **Join:** open the invite link; accept the consent and safety notice (AI coach, not a doctor; what to do in an emergency).
2. **Today:** today's session with its exercises, the next reminder time, and the current plan's review date.
3. **Reminders:** web push at the scheduled time, plus an "Add to calendar" `.ics` with the recurring sessions (works on every phone even without push; iOS web push only works when the app is installed to the home screen).
4. **Session (voice coach):**
   - Pain before (0–10), asked by voice or tapped.
   - For each exercise: the coach explains it in one or two sentences with the physio's notes, then the patient counts reps aloud. The coach stays quiet while counting, then confirms ("That's 10, nice. Rest 30 seconds."). On screen: big rep counter the patient can correct (+1 / −1), set progress, rest timer.
   - Pain after (0–10) and difficulty (easy / OK / hard).
   - **Without voice:** the same screens work with taps only (mic denied, noisy room, or preference).
5. **Next action** shown at the end of every session (see rules below).
6. **Request check-in:** button with a reason (pain, question, plan finished), visible always and suggested by the rules.

### Voice coach

- Gemini Live, audio only, browser → Gemini directly with a one-use token minted by the server . The token locks the system prompt, which includes **today's plan** (exercises, sets, reps, holds, physio notes, doctor restrictions) and the safety rules.
- Tools the model calls; the app applies them to the on-screen state:

| Tool | Effect |
|---|---|
| `record_pain(when, score)` | Fills pain before/after |
| `start_exercise(exercise_id)` | Moves the screen to that exercise |
| `log_set(exercise_id, set, reps)` | Sets the counter; patient can correct before it is saved |
| `skip_exercise(exercise_id, reason)` | Marks skipped with reason |
| `report_concern(kind, details)` | **Stops the session** if `kind` is a red flag (open wound, bleeding, signs of infection, fall, chest pain, dizziness, sharp new pain) |
| `finish_session(difficulty)` | Saves the session and shows the next action |

- The prompt forbids changing the plan, adding exercises, giving medication or diagnosis advice, and tells the coach to call `report_concern` instead.
- **Spike first (day 1):** counting aloud fights Gemini's turn detection; the model may reply after every number. Test (a) longer silence before end of turn plus "stay silent while the patient counts", and (b) the coach counting the tempo itself while the patient moves. Keep whichever is reliable; the tap counter is the fallback either way.

### Next-action rules (code, per session)

Checked in order; the first match wins for the patient message, and every match creates an alert for the care team.

| Condition | Patient sees | Alert (goes to) |
|---|---|---|
| Red-flag concern reported | Stop. Contact the clinic now; emergency number for emergencies | Urgent (doctor + physio) |
| Pain after ≥ plan threshold, or pain rose ≥ 3 during the session | Rest today and contact the clinic; request check-in button | High (doctor + physio) |
| Pain after rising over the last 3 sessions | Check-in suggested | Medium (physio) |
| Two scheduled sessions missed in a row (checked daily) | Gentle nudge; check-in suggested | Low adherence (physio) |
| Review date reached | "Time for your check-in"; request check-in | Review due (doctor + physio) |
| Otherwise | "Great work. Next session: tomorrow 08:00" | — |

### Data (Firestore)

| Collection | Fields |
|---|---|
| `clinicians/{uid}` | name, role (doctor / physio), clinic, contact (WhatsApp) |
| `exercises/{id}` | name, instructions, coaching cues, default sets/reps/hold, applies to (transtibial / transfemoral / upper limb), reviewed by |
| `patients/{id}` | doctorId, physioId, name, **profile** (amputation level and side, stage, cause, restrictions; entered once by the doctor and used by the coach, camera tracking, skin check and brief), invite code, timezone, consent time |
| `patients/{id}/plans/{id}` | version, exercises (id, sets, reps, hold, notes), schedule, start date, review date, pain threshold, active, created by (physio), limits set by (doctor) |
| `patients/{id}/sessions/{id}` | planId, scheduled for, started/ended, status (completed / partial / stopped / missed), sets done per exercise, pain before/after, difficulty, concerns, mode (voice / tap) |
| `patients/{id}/flags/{id}` | kind, severity, sessionId, created, resolved (by, at) |
| `patients/{id}/checkins/{id}` | kind (doctor review / therapy session), requested (reason, at), scheduled at, status, visit note, new planId |

**Seed library (draft until our physiotherapist reviews it; see Clinical input):** residual limb desensitisation (tapping, massage), prone lying (hip flexor contracture prevention), prone hip extension, side-lying hip abduction, bridging, isometric quadriceps (transtibial), seated trunk rotation, sit-to-stand with support, supported standing balance.

### Build

- One Nuxt app; routes `/care/**` (doctor and physio) and `/patient/**` (patient).
- Nitro server routes read and write Firestore with `firebase-admin`; the browser never writes Firestore directly in Phase 1.
- Care team sign-in: Firebase Auth email/password. Patient: invite code → signed session cookie.
- Reminders and missed-session checks: Cloud Scheduler hits a protected endpoint every 5 minutes.
- Deploy to Cloud Run.

### Demo mode

- Seed: one rehab doctor, one physiotherapist, two patients. Patient A is on track; Patient B has rising pain and two missed sessions, so the dashboard shows flags immediately.
- Demo-only controls: "advance one day" (to show missed sessions and review date arriving) and "reset demo".

### Done when

- [ ] Full loop with three browsers (doctor, physio, patient): set limits → prescribe → reminder → voice session → log → next action → check-in request → physio saves new plan version → patient sees new plan.
- [ ] Voice session works on desktop Chrome and phone Chrome/Safari; tap-only session works everywhere.
- [ ] Every rule in the next-action table is covered by a unit test.
- [ ] Deployed on Cloud Run with seeded demo data.

### Not in Phase 1

Camera, pose tracking, cross-session memory, AI summaries, photo checks, analytics, multiple clinics, caregiver accounts, telehealth video.

## Phase 2: AI enhancements

In order of value; each one is independent.

1. **Camera rep counting and form cues.** MediaPipe Pose Landmarker in the browser (on device; frames never stored or sent). Angle rules per exercise count reps and detect simple faults; events such as `rep 7` or `hips dropping` go to the coach as text, which turns them into spoken cues. Voice counting stays as fallback.
2. **Pre-visit summary for the care team.** Gemini on Vertex AI turns the sessions since the last visit into a structured brief: adherence, pain trend, what the patient said, discussion points, and **suggested** plan changes the physio accepts or ignores.
3. **Memory across sessions.** Goals ("walk to the mosque"), what hurts, what motivates; the coach opens with context ("Last time bridging was hard, let's take it slow"). Reuse `backend/src/memory-extractor.ts` ideas.
4. **Residual limb skin check.** Patient takes a photo weekly; Gemini vision flags redness, wounds or swelling as an urgent alert to the doctor. Flag only, never a diagnosis.
5. **Phantom limb pain and mood check-ins.** A short voice diary between sessions, charted for the care team.

## Phase 3: platform and scale

- **Pub/Sub** for flag events → notifier (care team email, WhatsApp, web push).
- **BigQuery** (Firestore export) for clinic analytics: adherence by cohort, pain outcomes, time to prosthetic milestones.
- Multiple clinics and roles, caregiver access, Indonesian/English UI.
- Accessibility pass: screen reader, large text, **one-handed use** (upper limb amputees), voice-only navigation.
- Installable PWA, WhatsApp reminders.

## Google Cloud footprint

| Phase | Services |
|---|---|
| 1 | Gemini Live (voice coach), Firestore, Firebase Auth, Cloud Run, Cloud Scheduler |
| 2 | Gemini on Vertex AI (summaries, vision), MediaPipe on device |
| 3 | Pub/Sub, BigQuery |

**Vertex AI and the voice coach:** Vertex AI does not issue ephemeral tokens (gemini-avatar.md), so a direct browser connection uses the Gemini Developer API. If judges need the live coach on Vertex too, route it through the Cloud Run gateway (`backend/`) at the cost of an extra hop.

## Clinical input (physiotherapist)

Involve at least one physiotherapist (and ideally a Sp.KFR rehab doctor) from the start, not only at the end.

| When | Ask them to |
|---|---|
| Before building the library | Review and correct the seed exercises, default doses, and which apply to transtibial / transfemoral / upper limb |
| Before the coach prompt is final | Review the red-flag list, the stop wording, and how the coach should cue each exercise |
| Phase 1 done | Try the care-team dashboard and a patient session; is the loop how they actually work? |
| Submission | A short quote or name for the pitch ("reviewed with ... , physiotherapist at ...") |

Their time is the scarce part: send one 15-minute review at a time, with the draft already written.


## Open decisions

- Submission deadline and demo format (live vs recorded); this sets how much of Phase 2 fits.
- UI and coach language: English, Indonesian, or both.
- Which physiotherapist (and rehab doctor) to approach first.
- Project name and repository location.
- Live coach on the Gemini Developer API (simpler) or Vertex via the gateway.
