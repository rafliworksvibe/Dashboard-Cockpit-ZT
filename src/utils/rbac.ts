import { auth } from "../firebase";
import { UserAccount } from "../types";

export const ADMIN_UID = "tL2vtXDWhXho5J5J0xPxofVtRho1";
export const SECONDARY_ADMIN_UID = "gIbkeiOdWINKMthEN7cPFEirky22";

export function checkIsAdmin(user?: UserAccount | null): boolean {
  const currentUid = auth.currentUser?.uid || user?.uid;
  return currentUid === ADMIN_UID || currentUid === SECONDARY_ADMIN_UID;
}

