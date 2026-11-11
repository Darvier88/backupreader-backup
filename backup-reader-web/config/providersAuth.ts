import {
  OAuthProvider,
  OAuthCredential,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import i18n from "../i18n";
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
  password: string,
  /* El nombre que escribio el usuario al crear la cuenta.
     Firebase no lo acepta en `createUserWithEmailAndPassword`, hay que
     guardarlo despues con `updateProfile`. Sin esto, la pantalla de registro
     pedia un nombre y lo tiraba: el usuario lo escribia y luego no aparecia
     por ninguna parte. */
  nombre?: string
) => {
  try {
    const result = await createUserWithEmailAndPassword(
      FirebaseAuth,
      correo,
      password
    );
    if (nombre && nombre.trim()) {
      try {
        await updateProfile(result.user, { displayName: nombre.trim() });
      } catch (error) {
        /* Que falle guardar el nombre no invalida la cuenta, que ya existe.
           Se avisa y se sigue: devolver error aqui dejaria al usuario fuera
           de una cuenta recien creada. */
        console.error("La cuenta se creo pero no se pudo guardar el nombre:", error);
      }
    }
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

/**
 * Mandar el correo de recuperación.
 *
 * Primero se intenta por nuestro endpoint, que escribe el correo con nuestro
 * diseño, en el idioma del usuario, y con un enlace que lleva a NUESTRA
 * pantalla. Si no hay proveedor configurado, o el endpoint no contesta, se
 * manda por Firebase como toda la vida.
 *
 * El repliegue no es por prudencia excesiva: no poder recuperar la cuenta es
 * de los peores fallos que puede tener esta aplicación, porque deja al usuario
 * fuera de sus propias conversaciones. Un correo feo es infinitamente mejor
 * que ningún correo.
 */
export const sendEmailResetPassword = async (
  correo: string
): Promise<{ ok: boolean; error?: unknown }> => {
  const porFirebase = async (): Promise<{ ok: boolean; error?: unknown }> => {
    try {
      await sendPasswordResetEmail(FirebaseAuth, correo);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  };

  try {
    const r = await fetch("/api/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo,
        idioma: (i18n.language || "es").startsWith("en") ? "en" : "es",
      }),
    });
    const datos = await r.json().catch(() => ({}));
    if (r.ok && datos?.ok && !datos?.repliega) return { ok: true };
  } catch (error) {
    console.error("El endpoint de recuperación no contestó; se usa el correo de Firebase.", error);
  }

  return porFirebase();
};
