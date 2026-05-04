/// <reference types="vite/client" />
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = firebaseConfig.apiKey
  ? initializeApp(firebaseConfig)
  : ({} as FirebaseApp);
export const auth = firebaseConfig.apiKey ? getAuth(app) : ({} as Auth);
export const db = firebaseConfig.apiKey ? getFirestore(app) : ({} as Firestore);
export const functions = firebaseConfig.apiKey
  ? getFunctions(app)
  : ({} as Functions);
