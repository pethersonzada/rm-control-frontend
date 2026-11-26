import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
} from "firebase/auth";

const env = import.meta.env;

export function firebaseAuth() {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !appId ||
    authDomain !== `${projectId}.firebaseapp.com`
  ) {
    throw new Error("A autenticação da homologação precisa ser configurada.");
  }
  return initializeAuth(
    initializeApp({ apiKey, authDomain, projectId, appId }),
    {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    },
  );
}
