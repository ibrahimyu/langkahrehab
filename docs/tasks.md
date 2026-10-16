# Tasks

Submission: **Saturday 18 October 2026** (exact time to confirm). Aim to submit a few hours early.

## Workstreams

| Workstream | Owner | Due |
|---|---|---|
| Patient app and AI features (coach, camera, memory, skin check, brief), data model, deployment | Ibrahim | Fri 17 Oct, evening |
| Care team app (doctor and physio views, records, plan editing) | Nabila | Fri 17 Oct, 18:00 (merged) |
| Pitch deck (prescribed template), demo video, submission description | Eka | Draft Fri 17 Oct; final Sat 18 Oct, 12:00 |

## How we work

- One branch per task, a pull request to `main`, and a quick review from another team member before merging.
- `main` always stays deployable: judges test the live link, and there are no retries if it breaks.
- **Feature freeze: Sat 18 Oct, 12:00.** Work that isn't merged by then stays out of the submission and goes on the roadmap slide. This applies to every workstream.
- `shared/model.ts` is shared by the patient and care team apps. Propose changes in an issue or the group chat first.
- Running late or blocked? Say so early in the group chat so we can rebalance the work.
- GitHub Issues mirror the checklists below.

## Patient app and AI features (Ibrahim)

- [x] Data model, demo cases, next-action rules, API
- [x] Patient: case picker, home, session (camera + voice over the whole plan), summary, skin check
- [x] Basic care pages (list, alerts, brief, plan editor, check-ins) as a starting point for the care team app
- [x] Guided scenarios with the patient's phone and a switchable physio dashboard; simulated sessions; app-wide language switch (EN, ID, 中文); sky and sun colours
- [ ] Media: patient portraits, X-ray-style images and 10-second exercise videos (`public/media/README.md`)
- [ ] Google Cloud project: Firestore, Firebase anonymous sign-in, Gemini key
- [ ] Deploy to Cloud Run with Firestore; minimum one instance during evaluation
- [ ] Test the full loop on the deployed link in Chrome, Safari and on a phone
- [ ] If time allows: camera position check before each set, check-in when the patient stops moving mid-set

## Care team app (Nabila)

Builds on `app/components/CarePanel.vue` (used both in `app/pages/care/` and as the dashboard in guided scenarios) and the API in [data-model.md](data-model.md). All text goes through `shared/i18n.ts` (EN, ID, 中文). The items below need no server changes.

- [ ] Care team home: patients by alert severity, review dates, last session, filters (needs attention / all)
- [ ] Patient record: profile (editable by the doctor via `PUT profile`), plan history, sessions with a pain chart, phantom pain chart, skin checks, memories
- [ ] Alerts: grouped by severity, filtered by role (doctor or physio), mark as handled
- [ ] Plan editor polish: exercise picker with descriptions, dose limits, comparison with the previous version
- [ ] Check-ins: schedule with a date, visit note, link to the plan version saved at the visit
- [ ] Role differences: the doctor sees the pain limit, review date and profile; the physio sees exercises and doses
- [ ] Works on a laptop at 1280 px and on a tablet

## Pitch deck, video and description (Eka)

- [ ] Get the **prescribed pitch deck template** and move the team deck's content into it
- [ ] Problem numbers with sources: WHO (2.4 billion people need rehabilitation), home exercise adherence studies, Kolegium KFR (about 2,000 more Sp.KFR needed). Check each source before using it
- [ ] Video following [demo-script.md](demo-script.md), **3:30 at most** (the limit is 3–4 minutes; over 4 is penalised)
- [ ] Submission description, starting from the draft in [submission.md](submission.md)
- [ ] Optional: a physiotherapist's quote or review of the exercises for the pitch

## Everyone

- [ ] Try the deployed link on your own laptop and phone, and report anything broken in GitHub Issues
- [ ] Final check of all submission links in a private window before submitting
