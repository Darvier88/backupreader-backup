import { User } from "../models/User";
import { Plan } from "../models/Plan";
import { FirebaseDB } from "../config/firebase";
import { createContext, useReducer } from "react";
import { FiresoreState, firestoreReducer } from "./FirestoreReducer";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/router";

type FirestoreContextProps = {
  user: User | null;
  errorMessage: string;
  status: "saving" | "saved" | "not-saved";
  subscription: Plan[] | null;
  planId: string | null;
  clean: () => void;
  getPlans: () => void;
  getUser: (uid: string, crearSiFalta?: User) => void;
  saveUser: (user: User) => void;
  setPlanId: (planId: string) => void;
  saveUserFromProviders: (user: User) => void;
  updateUser: (firestoreId: string, planId: string, name: string) => void;
  updateStorageSizeUser: (firestoreId: string, storageSize: number) => void;
  /** Marca (o quita, con null) la fecha en que un plan cancelado deja de valer. */
  updatePlanCancelAt: (firestoreId: string, cancelAt: number | null) => Promise<void>;
};

export const firestoreInitialState: FiresoreState = {
  status: "saving",
  user: null,
  errorMessage: "",
  subscription: null,
  planId: null,
};

export const FirestoreContext = createContext({} as FirestoreContextProps);

export const FirestoreProvider = ({ children }: any) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(firestoreReducer, firestoreInitialState);

  const saveUser = async (user: User) => {
    try {
      dispatch({
        type: "loading",
      });
      await setDoc(doc(FirebaseDB, "users", user.uid), { user });
      dispatch({
        type: "saveUser",
        payload: { user },
      });
    } catch (error) {
      console.log(error);
      dispatch({
        type: "addError",
        payload: "Error-creating-user",
      });
    }
  };

  const saveUserFromProviders = async (user: User) => {
    try {
      dispatch({
        type: "loading",
      });

      /* Lectura directa por id, no consulta sobre la colección: el documento se
         guarda con el uid como id (ver saveUser), así que la consulta era
         redundante. Y permitir 'list' sobre `users` dejaría que cualquier
         usuario autenticado enumerase a todos los demás, por eso las reglas lo
         deniegan. */
      const ref = doc(FirebaseDB, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, { user });
        dispatch({
          type: "saveUser",
          payload: { user },
        });
      } else {
        await updateDoc(ref, {
          "user.displayName": user.displayName,
          "user.photoURL": user.photoURL,
        });
        const actualizado: User = {
          ...snap.data().user,
          firestoreId: snap.id,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        dispatch({
          type: "saveUser",
          payload: { user: actualizado },
        });
      }
    } catch (error) {
      console.log(error);
      dispatch({
        type: "addError",
        payload: "Error-creating-user",
      });
    }
  };

  /**
   * Carga el perfil del usuario.
   *
   * Lectura directa por id, no consulta: además de ser una lectura en vez de
   * una query, es lo único que permiten las reglas.
   *
   * Si la credencial de Firebase existe pero falta el documento de Firestore
   * —registro interrumpido, o una cuenta creada fuera de la app— se crea al
   * vuelo con lo que se sabe de la sesión. Antes se volvía en silencio, y esa
   * cuenta quedaba inutilizable: sin `user` nadie redirige, el spinner se
   * apaga solo a los 15 s, y el usuario se queda en el login sin explicación.
   */
  const getUser = async (uid: string, crearSiFalta?: User) => {
    try {
      const ref = doc(FirebaseDB, "users", uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const user: User = { ...snap.data().user, firestoreId: snap.id };
        dispatch({
          type: "saveUser",
          payload: { user },
        });
        return;
      }

      if (crearSiFalta) {
        console.warn("Falta el perfil en Firestore; se crea desde la sesión.");
        await setDoc(ref, { user: crearSiFalta });
        dispatch({
          type: "saveUser",
          payload: { user: { ...crearSiFalta, firestoreId: uid } },
        });
        return;
      }

      /* No hay documento y no hay con qué crearlo. Se avisa en vez de callar,
         para que no vuelva a quedarse en un limbo silencioso. */
      console.warn("No existe el perfil de", uid, "y no se recibió con qué crearlo.");
      dispatch({
        type: "addError",
        payload: "Error-creating-user",
      });
    } catch (error) {
      console.log("Error obteniendo usuario", error);
      dispatch({
        type: "addError",
        payload: "Error-creating-user",
      });
    }
  };

  const updateUser = async (uid: string, planId: string, name: string) => {
    const ref = doc(FirebaseDB, "users", uid);
    await updateDoc(ref, {
      "user.plan": planId,
    });
  };


  /**
   * Guarda hasta cuándo sigue valiendo un plan cancelado.
   *
   * No se borra `user.plan`: el usuario pagó el periodo en curso y se le deja
   * terminarlo. Quien decide a partir de esa fecha es `tieneAcceso`.
   *
   * Se vuelve a leer el usuario al terminar para que la pantalla refleje el
   * cambio sin recargar.
   */
  const updatePlanCancelAt = async (uid: string, cancelAt: number | null) => {
    const ref = doc(FirebaseDB, "users", uid);
    await updateDoc(ref, { "user.planCancelAt": cancelAt });
    await getUser(uid);
  };


  const updateStorageSizeUser = async (uid: string, storageSize: number) => {
    const ref = doc(FirebaseDB, "users", uid);
    await updateDoc(ref, {
      "user.storageSize": storageSize,
    });
  };


  const getPlans = async () => {
    try {
      const subscriptions: Plan[] = [];
      const querySnapshot = await getDocs(collection(FirebaseDB, "plans"));
      querySnapshot.forEach((doc) => {
        subscriptions.push({ details: doc.data().plan, id: doc.id });
      });
      dispatch({
        type: "plans",
        payload: subscriptions,
      });
    } catch (error) {}
  };

  const setPlanId = (planId: string) => {
    dispatch({
      type: "setPlanId",
      payload: planId,
    });
  };

  const clean = () => {
    dispatch({
      type: "clean",
    });
  };

  return (
    <FirestoreContext.Provider
      value={{
        ...state,
        clean,
        saveUser,
        getUser,
        getPlans,
        setPlanId,
        updateUser,
        saveUserFromProviders,
        updateStorageSizeUser,
        updatePlanCancelAt,
      }}
    >
      {children}
    </FirestoreContext.Provider>
  );
};
