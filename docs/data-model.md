# Data model and API

The contract between the patient app and the care team app. Types live in [`shared/model.ts`](../shared/model.ts). Both apps depend on them, so propose changes in an issue first.

## Storage

```
workspaces/{workspaceId}                 Workspace  { createdAt, offsetDays }
workspaces/{workspaceId}/patients/{id}   Patient    (one document per patient)
```

- A **workspace** is one visitor's demo copy. With Firebase configured it is the visitor's anonymous Firebase user id; locally it is a random id kept in the browser. New workspaces are seeded with the four cases in [`shared/cases.ts`](../shared/cases.ts).
- **One document per patient** keeps reads simple and updates atomic (`updatePatient` runs a Firestore transaction). Lists are capped (sessions 100, memories 50, diary 200, alerts 100), well under Firestore's 1 MB document limit.
- The **demo clock** is real time plus `offsetDays` (the "Next day" button). Server code uses `now` from `context(event)`, never `Date.now()` directly, for anything the patient or care team sees.
- `NUXT_STORAGE=local` writes the same shapes to `.data/` for development.

## Patient

| Field | Type | Written by |
|---|---|---|
| `id`, `name`, `age`, `story`, `lang` | basics; `lang` is `id`, `en` or `zh` | seed |
| `profile` | `{ level, side, stage, cause, restrictions }` | doctor (`PUT profile`) |
| `plan` | `{ version, items[{exerciseId, sets, reps}], note, painThreshold, reviewDate, updatedAt, updatedBy }` | physio (items, note), doctor (threshold, review date) via `PUT plan` |
| `planHistory` | earlier `Plan`s, oldest first | `PUT plan` |
| `sessions` | `SessionRecord[]`: exercises with reps per set, pain before/after, difficulty, concern, `nextAction` | patient app (`POST sessions`) |
| `memories` | `{ kind, text, source }[]`: goal, motivation, difficulty, preference, life, other | coach, patient, care team |
| `diary` | `{ kind, score 0–10, note }[]`: phantom_pain, phantom_sensation, mood | coach, patient, care team |
| `skinChecks` | `{ area, lang, result{ usable, findings, urgency, patientMessage, careTeamNote } }[]` | `POST skin-check` |
| `alerts` | `{ kind, severity, message, for[], sessionId, resolvedAt, resolvedBy }[]` | rules; care team resolves |
| `checkIns` | `{ kind, reason, status, scheduledFor, visitNote, planVersion }[]` | patient requests; care team schedules and completes |
| `brief` | `{ text, lang, generatedAt, editedAt }` | Gemini, then care team edits |

Exercise ids: `bridging`, `side-lying-abduction`, `prone-hip-extension`, `sit-to-stand` ([`shared/exercises.ts`](../shared/exercises.ts)).

## Alerts (rules in [`shared/rules.ts`](../shared/rules.ts))

| Kind | When | Severity | For |
|---|---|---|---|
| `red_flag` | Coach called `report_concern` (wound, infection, fall, chest pain, breathing, dizziness, severe pain) | urgent | doctor, physio |
| `pain_high` | Pain after ≥ plan's pain limit, or rose by 3+ in a session | high | doctor, physio |
| `pain_rising` | Pain after rose over the last 3 sessions | medium | physio |
| `missed_sessions` | No session for 2+ days (daily check) | low | physio |
| `review_due` | Review date reached | low | doctor, physio |
| `skin` | Skin check urgency `contact_soon` or `urgent` | high / urgent | doctor, physio |

An alert of a kind that is already open is not added again (red flags always are).

## API

All requests carry the visitor's identity: `Authorization: Bearer <Firebase ID token>`, or `x-workspace: <id>` locally. In the app, use `useApi()`, which adds it.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/patients` | | `{ patients: PatientSummary[], now }` |
| GET | `/api/patients/:id` | | `{ patient, stats, now }` |
| PUT | `/api/patients/:id/profile` | `Profile` | profile |
| PUT | `/api/patients/:id/plan` | `{ items, note, painThreshold, reviewDate, role }` | new plan (version + 1) |
| POST | `/api/patients/:id/memories` | `{ kind, text, source }` | memories |
| PUT | `/api/patients/:id/memories` | `Memory[]` (after edits) | memories |
| POST | `/api/patients/:id/diary` | `{ kind, score, note, source }` | diary |
| POST | `/api/patients/:id/sessions` | session from the patient app | `{ session, alerts }` |
| PATCH | `/api/patients/:id/alerts/:alertId` | `{ role }` | alerts (resolved) |
| POST | `/api/patients/:id/checkins` | `{ kind, reason, role }` | check-ins |
| PATCH | `/api/patients/:id/checkins/:checkInId` | `{ status?, scheduledFor?, visitNote? }` | check-ins |
| POST | `/api/patients/:id/brief` | `{ lang }` | `{ brief, stats }` (Gemini) |
| PUT | `/api/patients/:id/brief` | `{ text }` | brief |
| POST | `/api/patients/:id/skin-check` | `{ image (JPEG base64), area, lang }` | `{ check, checks, alert }` (Gemini) |
| POST | `/api/live-token` | `{ patientId, settings }` | one-use Gemini Live token + setup |
| GET | `/api/demo/state` | | `{ workspace, now }` |
| POST | `/api/demo/next-day` | | moves the clock, runs daily rules |
| POST | `/api/demo/reset` | | re-seeds all cases |
| POST | `/api/patients/:id/reset` | | re-seeds one case (each guided scenario starts with this) |

`stats` (from [`shared/stats.ts`](../shared/stats.ts)) has adherence, average pain before/after, phantom pain and counts; use it for charts and numbers instead of recalculating.
