export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan?: string | null;
  token?: string | null;
  firestoreId?: string;
  storageSize?: number | null;
};
