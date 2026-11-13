import { createContext, useContext, useReducer } from "react";

import { User } from "../models/User";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { ModalContext } from "./ModalContext";
import { authReducer, AuthState } from "./AuthReducer";
import { InformationModal } from "../components/modals";
import { logOutFunction, signInWithApple } from "../config/providersAuth";

import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
  sendEmailResetPassword,
  signInWithGoogle,
} from "../config/providersAuth";
import { FirestoreContext } from ".";

type AuthContextProps = {
  user: User | null;
  statusOfPlan: boolean | null;
  errorMessage: string;
  status: "cheking" | "autheticated" | "not-autheticated" | null;
  logOut: () => void;
  signInApple: () => void;
  signInGoogle: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  /** Devuelven si entró, para que la pantalla sepa cuándo dejar de esperar. */
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, nombre?: string) => Promise<boolean>;
};

export const authInitialState: AuthState = {
  status: null,
  user: null,
  statusOfPlan: null,
  errorMessage: "",
};

export const AuthContext = createContext({} as AuthContextProps);

/**
 * Convierte el código de error de Firebase en algo que el usuario pueda
 * accionar. Devuelve la cadena en español, que es la CLAVE de i18n: quien
 * llama la pasa por `t()` para que se traduzca al cambiar de idioma.
 */
const motivoDeFalloAlRegistrar = (error: any): string => {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Ese correo ya tiene una cuenta. Prueba a iniciar sesión.";
    case "auth/invalid-email":
      return "El correo no tiene un formato válido.";
    case "auth/weak-password":
      return "La contraseña es demasiado débil. Usa al menos 6 caracteres.";
    case "auth/operation-not-allowed":
      return "El registro con correo y contraseña está desactivado. Avísanos para habilitarlo.";
    case "auth/network-request-failed":
      return "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    default:
      return "No ha sido posible crear la cuenta. Inténtalo de nuevo en un momento.";
  }
};

export const AuthProvider = ({ children }: any) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { show } = useContext(ModalContext);
  const { saveUser, saveUserFromProviders } = useContext(FirestoreContext);
  const [state, dispatch] = useReducer(authReducer, authInitialState);

  const signUp = async (email: string, password: string, nombre?: string): Promise<boolean> => {
    dispatch({
      type: "loading",
    });
    const resp = await signUpWithEmailPassword(email, password, nombre);
    const { ok, user } = resp;

    if (ok && user) {
      saveUser(user);
      dispatch({
        type: "signUp",
        payload: { user },
      });
      return true;
    } else {
      /* Antes este modal decía SIEMPRE "el correo ya se encuentra registrado",
         fallara lo que fallara. Si el registro se caía por otro motivo
         —contraseña rechazada, sin conexión, o el método de correo y
         contraseña desactivado en la consola de Firebase— al usuario se le
         daba una explicación falsa y no había forma de averiguar lo que
         pasaba de verdad. Ahora se traduce el código real. */
      console.error("Fallo al crear la cuenta:", (resp as any)?.error);
      show({
        width: "min(420px, 92vw)",
        modalContent: (
          <InformationModal
            title={t("Aviso")}
            text={t(motivoDeFalloAlRegistrar((resp as any)?.error))}
          />
        ),
      });
      dispatch({
        type: "addError",
        payload: "signUpFail",
      });
      dispatch({
        type: "notAuthenticated",
      });
      return false;
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    dispatch({
      type: "loading",
    });
    const resp = await signInWithEmailPassword(email, password);
    const { ok, user } = resp;
    if (ok) {
      dispatch({
        type: "signUp",
        payload: { user },
      });
      return true;
    } else {
      dispatch({
        type: "addError",
        payload: "signInFail",
      });
      dispatch({
        type: "notAuthenticated",
      });
      show({
        width: "min(420px, 92vw)",
        modalContent: (
          <InformationModal
            title={t("Aviso")}
            text={t("El correo o la contraseña no son correctos.")}
          />
        ),
      });
      return false;
    }
  };

  const signInApple = async () => {
    dispatch({
      type: "loading",
    });
    const resp = await signInWithApple();
    const { ok, user } = resp;
    if (ok && user) {
      saveUserFromProviders(user);
      dispatch({
        type: "signUp",
        payload: { user },
      });
    } else {
      dispatch({
        type: "addError",
        payload: "signInFail",
      });
      dispatch({
        type: "notAuthenticated",
      });
    }
  };

  const signInGoogle = async () => {
    dispatch({
      type: "loading",
    });
    const resp = await signInWithGoogle();
    const { ok, user } = resp;
    if (ok && user) {
      saveUserFromProviders(user);
      dispatch({
        type: "signUp",
        payload: { user },
      });
    } else {
      dispatch({
        type: "addError",
        payload: "signInFail",
      });
      dispatch({
        type: "notAuthenticated",
      });
    }
  };

  /**
   * Envia el correo para restablecer la contrasena.
   *
   * YA NO REDIRIGE.
   * Antes hacia `router.replace("/auth")` en las dos ramas, la de exito y la
   * de error. Eso dejaba la pantalla de "Revisa tu correo" sin poder verse: se
   * asomaba un instante y la aplicacion te sacaba de ahi. Y como tambien
   * redirigia al fallar, un fallo se vivia igual que un acierto.
   *
   * Devuelve si salio bien y deja que la pantalla decida que ensenar. El
   * mensaje que ve el usuario es el mismo en los dos casos, a proposito, para
   * no revelar que correos tienen cuenta; pero eso es cosa de la pantalla, no
   * de aqui.
   */
  const resetPassword = async (email: string): Promise<boolean> => {
    dispatch({ type: "loading" });
    const { ok, error } = await sendEmailResetPassword(email);
    if (!ok) console.error("No se pudo enviar el correo de restablecimiento:", error);
    dispatch({ type: "loading" });
    return !!ok;
  };

  const logOut = async () => {
    dispatch({
      type: "loading",
    });
    await logOutFunction();
    router.replace("/");
    dispatch({
      type: "notAuthenticated",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        logOut,
        signInApple,
        signInGoogle,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
