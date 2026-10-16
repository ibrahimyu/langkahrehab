# Submission checklist

| Item | Requirement | Owner | Done |
|---|---|---|---|
| Pitch deck | **Prescribed template**, or risk disqualification | Eka | [ ] |
| Video | 3–4 minutes, clearly shows working functionality ([script](demo-script.md)) | Eka | [ ] |
| Deployed prototype | Public, working for the whole evaluation; no retries (Cloud Run, min 1 instance, billing alert) | Ibrahim | [ ] |
| GitHub repository | Public, source and supporting material, README links filled | Ibrahim | [ ] |
| Brief description | What we built and how it uses Firebase, Firestore, Cloud Run and Gemini (draft below) | Eka | [ ] |

Before submitting: open every link in a private window on another device; check the prototype works without signing in; check the repo has no `.env` or keys.

## Brief description (draft)

Langkah is an AI rehab coach for people recovering from a leg amputation, and a shared view for their rehab doctor and physiotherapist. Patients exercise at home with a real-time voice coach that speaks Indonesian, English or Chinese in simple words, while the phone or laptop camera counts their reps on the device. The coach knows the patient's plan, which leg was amputated and what they told it before; it records pain and phantom limb pain and stops the session if the patient mentions a danger sign. After each session, plain rules decide the next step and alert the care team when pain rises, sessions are missed or a red flag appears. The care team gets an AI-written brief before each visit and edits the plan, which the patient sees next time.

How we use Google Cloud:
- **Gemini**: the Gemini Live API runs the voice coach in the browser, with tool calls that drive the session (pain scores, sets, red flags, memories); Gemini Flash writes the care team brief and checks skin photos with structured output.
- **Firebase**: anonymous Authentication gives every visitor an isolated demo workspace with no sign-up.
- **Firestore**: stores all patient data (profile, plan versions, sessions, memories, diary, skin check results, alerts, check-ins, brief), updated in transactions; client access is denied by security rules.
- **Cloud Run**: hosts the Nuxt web app and API, verifies Firebase tokens, runs the rules and mints one-use Gemini Live tokens with the coach's instructions locked in.

Rep counting uses MediaPipe Pose on the device, so camera video never leaves the browser.
