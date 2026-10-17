import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";

// Each visitor signs in anonymously and gets their own copy of the prepared cases.
// Without a Firebase config (local development), useApi falls back to a random browser id.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public.firebase;
  if (!config.apiKey) return { provide: { idToken: async () => null as string | null } };

  const auth = getAuth(initializeApp(config));
  const ready = new Promise<User>((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user);
      }
    });
    signInAnonymously(auth).catch(reject);
  });
  return { provide: { idToken: async () => (await ready).getIdToken() } };
});
