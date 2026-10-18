# Deploy

## One-time Google Cloud and Firebase setup

1. Create a Google Cloud project and add Firebase to it (Firebase console → Add project → choose the existing Google Cloud project).
2. **Firestore**: create the database in Native mode, location `asia-southeast2` (Jakarta). Publish [`firestore.rules`](../firestore.rules) with `firebase deploy --only firestore:rules` (deny all client access).
3. **Authentication**: enable the **Anonymous** sign-in provider. Add the Cloud Run domain to *Authorized domains* after the first deploy.
4. **Web app**: register a web app in Firebase and copy its config (apiKey, authDomain, projectId, appId). These values are public.
5. **Gemini**: create an API key in the same project (Google AI Studio → API keys, or APIs & Services → Credentials with the Generative Language API enabled). Set a **billing budget alert**.
6. Enable **Cloud Run**, **Cloud Build** and **Artifact Registry**.

## Deploy to Cloud Run

From the repository root, with `gcloud` signed in and the project selected:

```bash
gcloud run deploy langkah --source . --region asia-southeast2 --allow-unauthenticated --min-instances 1 --max-instances 3 --memory 1Gi --set-env-vars "NUXT_STORAGE=firestore,NUXT_GEMINI_DAILY_CALLS=2000,NUXT_PUBLIC_FIREBASE_API_KEY=...,NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...,NUXT_PUBLIC_FIREBASE_PROJECT_ID=...,NUXT_PUBLIC_FIREBASE_APP_ID=..." --set-secrets "NUXT_GEMINI_API_KEY=gemini-api-key:latest,NUXT_CRON_SECRET=cron-secret:latest"
```

- Store the Gemini key in Secret Manager as `gemini-api-key` and a random string as `cron-secret` first, and give the Cloud Run service account the *Secret Manager Secret Accessor* role.
- The Cloud Run service account needs the **Cloud Datastore User** role for Firestore. Verifying Firebase ID tokens needs no extra role, only the project id.
- `--min-instances 1` avoids cold starts during evaluation; lower it afterwards to save money.

## After deploying

- Add the `*.run.app` domain to Firebase Authentication → Authorized domains.
- Open the link in a private window on a laptop and on a phone (camera and microphone need the https link): sign in as the patient, run a short session, then sign in as the physio and the doctor and check the triage list and the brief.
- Check Cloud Run logs for errors.

## Daily cycle

The daily check (missed sessions, plan proposals, readiness, family tasks, briefs) also runs on the first request of each day. To run it at a fixed time, add a Cloud Scheduler job:

```bash
gcloud scheduler jobs create http langkah-daily --location asia-southeast2 --schedule "0 5 * * *" --time-zone "Asia/Jakarta" --http-method POST --uri "https://<service-url>/api/cron/daily" --headers "x-cron-secret=<cron-secret value>"
```

## Environment

| Variable | Needed | Notes |
|---|---|---|
| `NUXT_GEMINI_API_KEY` | yes | Secret. Coach, Talk, letter reading, brief, triage |
| `NUXT_STORAGE` | yes | `firestore` on Cloud Run (the image sets it) |
| `NUXT_PUBLIC_FIREBASE_*` | yes | Firebase web config (public values) |
| `NUXT_GEMINI_DAILY_CALLS` | no | Daily cap for all visitors together (default 2000) |
| `NUXT_CRON_SECRET` | no | Turns on `POST /api/cron/daily` |
| `NUXT_LIVE_MODEL`, `NUXT_TEXT_MODEL` | no | Model overrides |
