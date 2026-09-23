import {
  OAuthProvider,
  OAuthCredential,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { FirebaseAuth } from "./firebase";

import { fetchSignInMethodsForEmail } from "firebase/auth";

const appleAuthprovider = new OAuthProvider("apple.com");

const googleAuthProvider = new GoogleAuthProvider();

// ...

export const checkIfRegistered = async (email: string) => {
  const result = await fetchSignInMethodsForEmail(FirebaseAuth, email).then(
    (result) => {
      if (result.length === 0) {
        return false;
      } else {
        return true;
      }
    }
  );
  return result;
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(FirebaseAuth, googleAuthProvider);
    // const credentials = GoogleAuthProvider.credentialFromResult(result);
    const { uid, email, displayName, photoURL } = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result) as OAuthCredential;
    const token = credential.accessToken;

    console.log('Token '+token)


    return {
      ok: true,
      user: {
        uid,
        email,
        photoURL,
        plan: null,
        displayName,
        token: token
      },
    };
  } catch (error) {
    return {
      ok: false,
      user: null,
      error,
    };
  }
};

export const signInWithApple = async () => {
  try {
    const result = await signInWithPopup(FirebaseAuth, appleAuthprovider);
    // const credentials = OAuthProvider.credentialFromResult(result);

    const { uid, email, displayName, photoURL } = result.user;
    return {
      ok: true,
      user: {
        uid,
        email,
        photoURL,
        plan: null,
        displayName,
      },
    };
  } catch (error) {
    return {
      ok: false,
      user: null,
      error,
    };
  }
};

export const signUpWithEmailPassword = async (
  correo: string,
  password: string
) => {
  try {
    const result = await createUserWithEmailAndPassword(
      FirebaseAuth,
      correo,
      password
    );
    const { uid, email, displayName, photoURL } = result.user;
    return {
      ok: true,
      user: {
        uid,
        email,
        photoURL,
        plan: null,
        displayName,
      },
    };
  } catch (error) {
    return {
      ok: false,
      user: null,
      error,
    };
  }
};

export const signInWithEmailPassword = async (
  correo: string,
  password: string
) => {
  try {
    const result = await signInWithEmailAndPassword(
      FirebaseAuth,
      correo,
      password
    );
    const { uid, email, displayName, photoURL } = result.user;
    return {
      ok: true,
      user: {
        uid,
        email,
        displayName,
        photoURL,
      },
    };
  } catch (error) {
    return {
      ok: false,
      user: null,
      error,
    };
  }
};

export const logOutFunction = async () => {
  try {
    return await FirebaseAuth.signOut();
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
};

export const sendEmailResetPassword = async (correo: string) => {
  try {
    await sendPasswordResetEmail(FirebaseAuth, correo);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
};
