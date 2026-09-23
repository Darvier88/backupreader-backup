import { User } from "../models/User";
import { Plan } from "../models/Plan";
import { FirebaseDB } from "../config/firebase";
import { createContext, useReducer } from "react";
import { FiresoreState, firestoreReducer } from "./FirestoreReducer";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
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
  getUser: (uid: string) => void;
  saveUser: (user: User) => void;
  setPlanId: (planId: string) => void;
  saveUserFromProviders: (user: User) => void;
  updateUser: (firestoreId: string, planId: string, name: string) => void;
  updateStorageSizeUser: (firestoreId: string, storageSize: number) => void;
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
      const q = query(
        collection(FirebaseDB, "users"),
        where("user.uid", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        await setDoc(doc(FirebaseDB, "users", user.uid), { user });
      } else {
        const ref = doc(FirebaseDB, "users", user.uid);
        await updateDoc(ref, {
          "user.displayName": user.displayName,
          "user.photoURL": user.photoURL,
        });
        querySnapshot.forEach((doc) => {
          const user: User = { ...doc.data().user };
          dispatch({
            type: "saveUser",
            payload: { user },
          });
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

  const getUser = async (uid: string) => {
    try {
      const q = query(
        collection(FirebaseDB, "users"),
        where("user.uid", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const user: User = { ...doc.data().user, firestoreId: doc.id };
        //console.log('obteniendolo nano... ',user)
        dispatch({
          type: "saveUser",
          payload: { user },
        });
      });
    } catch (error) {
      //console.log('Error obteniendo usuario '+error);
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
        //console.log(doc.id, " => ", doc.data());
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
      }}
    >
      {children}
    </FirestoreContext.Provider>
  );
};
