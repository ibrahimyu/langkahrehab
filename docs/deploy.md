# Deploy

## One-time Google Cloud and Firebase setup

1. Create a Google Cloud project and add Firebase to it (Firebase console → Add project → choose the existing Google Cloud project).
2. **Firestore**: create the database in Native mode, location `asia-southeast2` (Jakarta). Publish [`firestore.rules`](../firestore.rules) (deny all client access).
3. **Authentication**: enable the **Anonymous** sign-in provider. Add the Cloud Run domain to *Authorized domains* after the first deploy.
4. **Web app**: register a web app in Firebase and copy its config (apiKey, authDomain, projectId, appId). These values are public.
5. **Gemini**: create an API key in the same project (Google AI Studio → API keys, or APIs & Services → Credentials with the Generative Language API enabled). Set a **billing budget alert**.
6. Enable **Cloud Run**, **Cloud Build** and **Artifact Registry**.

## Deploy to Cloud Run

From the repository root, with `gcloud` signed in and the project selected:

```bash
gcloud run deploy langkah --source . --region asia-southeast2 --allow-unauthenticated --min-instances 1 --max-instances 3 --memory 1Gi --set-env-vars "NUXT_STORAGE=firestore,NUXT_PUBLIC_FIREBASE_API_KEY=...,NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...,NUXT_PUBLIC_FIREBASE_PROJECT_ID=...,NUXT_PUBLIC_FIREBASE_APP_ID=..." --set-secrets "NUXT_GEMINI_API_KEY=gemini-api-key:latest"
```

- Store the Gemini key in Secret Manager as `gemini-api-key` first, and give the Cloud Run service account the *Secret Manager Secret Accessor* role.
- The Cloud Run service account needs the **Cloud Datastore User** role for Firestore. Verifying Firebase ID tokens needs no extra role, only the project id.
- `--min-instances 1` avoids cold starts during evaluation; lower it afterwards to save money.

## After deploying

- Add the `*.run.app` domain to Firebase Authentication → Authorized domains.
- Open the link in a private window: pick a case, run a short session, switch to Physio, generate a brief.
- Check Cloud Run logs for errors.
