import { createContext, useContext, useReducer } from "react";

import { User } from "../models/User";
import { useRouter } from "next/router";
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
  resetPassword: (email: string) => void;
  signIn: (email: string, password: string) => void;
  signUp: (email: string, password: string) => void;
};

export const authInitialState: AuthState = {
  status: null,
  user: null,
  statusOfPlan: null,
  errorMessage: "",
};

export const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: any) => {
  const router = useRouter();
  const { show } = useContext(ModalContext);
  const { saveUser, saveUserFromProviders } = useContext(FirestoreContext);
  const [state, dispatch] = useReducer(authReducer, authInitialState);

  const signUp = async (email: string, password: string) => {
    dispatch({
      type: "loading",
    });
    const resp = await signUpWithEmailPassword(email, password);
    const { ok, user } = resp;

    if (ok && user) {
      saveUser(user);
      dispatch({
        type: "signUp",
        payload: { user },
      });
    } else {
      show({
        modalContent: (
          <InformationModal
            title="Aviso"
            text="No ha sido posible realizar el registro, el correo ya se encuentra registrado."
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
    }
  };

  const signIn = async (email: string, password: string) => {
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
    } else {
      dispatch({
        type: "addError",
        payload: "signInFail",
      });
      dispatch({
        type: "notAuthenticated",
      });
      show({
        modalContent: (
          <InformationModal
            title="Aviso"
            text="Los datos ingresados, no son correctos."
          />
        ),
      });
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

  const resetPassword = async (email: string) => {
    dispatch({
      type: "loading",
    });
    const resp = await sendEmailResetPassword(email);
    const { ok, error } = resp;
    if (ok) {
      dispatch({
        type: "loading",
      });
      router.replace("/auth");
    } else {
      console.log(error);
      dispatch({
        type: "loading",
      });
      router.replace("/auth");
    }
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
