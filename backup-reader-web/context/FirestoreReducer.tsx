import { Plan } from "../models/Plan";
import { User } from "../models/User";

export interface FiresoreState {
  user: User | null;
  status: "saving" | "saved" | "not-saved";
  errorMessage: string;
  subscription: Plan[] | null;
  planId: string | null;
}

type FirestoreAction =
  | { type: "clean" }
  | { type: "loading" }
  | { type: "removeError" }
  | { type: "plans"; payload: Plan[] }
  | { type: "addError"; payload: string }
  | { type: "setPlanId"; payload: string }
  | { type: "saveUser"; payload: { user: User | null } };

export const firestoreReducer = (
  state: FiresoreState,
  action: FirestoreAction
): FiresoreState => {
  switch (action.type) {
    case "addError":
      return {
        ...state,
        status: "not-saved",
        errorMessage: action.payload,
      };
    case "removeError":
      return {
        ...state,
        errorMessage: "",
      };

    case "saveUser":
      return {
        ...state,
        errorMessage: "",
        status: "saved",
        user: action.payload.user,
      };
    case "loading":
      return {
        ...state,
        status: "saving",
        user: null,
      };
    case "plans":
      return {
        ...state,
        subscription: action.payload,
      };
    case "setPlanId":
      return {
        ...state,
        planId: action.payload,
      };

    case "clean":
      return {
        ...state,
        user: null,
      };

    default:
      return state;
  }
};
