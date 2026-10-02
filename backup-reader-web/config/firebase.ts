import { getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

//Initialize Firebase
export const FirebaseApp = initializeApp(firebaseConfig);
export const FirebaseAuth = getAuth(FirebaseApp);
export const FirebaseDB = getFirestore(FirebaseApp);

const app = getApp();
export const storage = getStorage(app, "gs://backup-reader.appspot.com/");

/**
 * Emuladores en desarrollo.
 *
 * Sin esto, probar la bóveda a mano escribe documentos `vaults/{uid}` REALES en
 * producción. Se activa poniendo en `.env.local`:
 *
 *   NEXT_PUBLIC_USE_EMULATORS=1
 *   NEXT_PUBLIC_EMULATOR_HOST=127.0.0.1      (o la IP del PC, para probar en el móvil)
 *
 * El guard de `window` es necesario porque este archivo también se evalúa en el
 * render de servidor, y conectar dos veces lanza excepción.
 */
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_EMULATORS === "1" &&
  !(window as any).__emuladoresConectados
) {
  const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
  connectFirestoreEmulator(FirebaseDB, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectAuthEmulator(FirebaseAuth, `http://${host}:9099`, { disableWarnings: true });
  (window as any).__emuladoresConectados = true;
  console.info(`[dev] Conectado a los emuladores en ${host}`);
}
