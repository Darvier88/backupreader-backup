import { User } from "../models/User";

export interface AuthState {
  user: User | null;
  status: "cheking" | "autheticated" | "not-autheticated" | null;
  statusOfPlan: boolean | null;
  errorMessage: string;
}

type AuthAction =
  | { type: "signUp"; payload: { user: User | null } }
  | { type: "addError"; payload: string }
  | { type: "loading" }
  | { type: "removeError" }
  | { type: "notAuthenticated" }
  | { type: "statusPlan"; payload: boolean };

export const authReducer = (
  state: AuthState,
  action: AuthAction
): AuthState => {
  switch (action.type) {
    case "addError":
      return {
        ...state,
        user: null,
        status: "not-autheticated",
        errorMessage: action.payload,
      };
    case "removeError":
      return {
        ...state,
        errorMessage: "",
      };
    case "signUp":
      return {
        ...state,
        errorMessage: "",
        status: "autheticated",
        user: action.payload.user,
      };
    case "notAuthenticated":
      return {
        ...state,
        status: "not-autheticated",
        user: null,
      };
    case "statusPlan":
      return {
        ...state,
        statusOfPlan: action.payload,
      };
    case "loading":
      return {
        ...state,
        status: "cheking",
        user: null,
      };

    default:
      return state;
  }
};
