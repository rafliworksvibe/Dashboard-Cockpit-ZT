import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  sendEmailVerification,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, auth, storage } from "./firebase";
import { 
  ProgramJob, 
  MeetingLog, 
  CloudDocument, 
  AttachmentFile, 
  UserAccount 
} from "./types";
import { 
  addProgram, 
  getPrograms, 
  deleteProgram as deleteDashboardProgram, 
  addMeetingLog, 
  getMeetingLogs, 
  deleteMeetingLog as deleteDashboardMeetingLog, 
  getDocuments, 
  deleteDocument as deleteDashboardDocument 
} from "./services/dashboardService";
import { initialPrograms, initialLogs } from "./mockData";

// Fungsi pembantu
export function deduplicatePrograms(progs: ProgramJob[]): { unique: ProgramJob[], duplicates: ProgramJob[] } {
  const seenTopics = new Set<string>();
  const unique: ProgramJob[] = [];
  const duplicates: ProgramJob[] = [];

  for (const prog of progs) {
    if (seenTopics.has(prog.topic)) {
      duplicates.push(prog);
    } else {
      seenTopics.add(prog.topic);
      unique.push(prog);
    }
  }
  return { unique, duplicates };
}

export function isQuotaExceeded(): boolean {
  return false;
}

export function resetQuotaStatus(): void {}

export function isLocalFallbackActive(): boolean {
  return false;
}

export function toggleLocalFallback(forceLocal: boolean): void {}

export function clearLocalFallbackCache(): void {}

// --- Helper to Compress Image Client-Side ---
async function compressImage(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.75): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  
  // Don't compress very small files
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// --- Attachment File Upload Helper ---
export function uploadAttachmentToStorage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<AttachmentFile> {
  return new Promise(async (resolve, reject) => {
    try {
      const fileToUpload = await compressImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          if (onProgress) onProgress(100);
          resolve({
            name: fileToUpload.name,
            size: fileToUpload.size,
            type: fileToUpload.type || "application/octet-stream",
            dataUrl: reader.result as string,
            downloadURL: reader.result as string,
            storagePath: ""
          });
        } else {
          reject(new Error("Gagal membaca file"));
        }
      };
      reader.onerror = () => reject(reader.error || new Error("FileReader error"));
      reader.readAsDataURL(fileToUpload);
    } catch (err: any) {
      reject(err);
    }
  });
}

// --- Document File Upload Helper (ARSIP DOKUMEN ONLY) ---
export function uploadDocumentToStorage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<AttachmentFile> {
  return uploadAttachmentToStorage(file, onProgress);
}

export async function uploadFileToStorage(file: File): Promise<AttachmentFile> {
  return uploadAttachmentToStorage(file);
}

// --- Firebase Auth State Management ---
let cachedUid: string | null = null;
let cachedUser: UserAccount | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Date) {
    return obj.toISOString() as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizePayload(item))
      .filter((item) => item !== undefined) as any;
  }
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, any>)[key];
    if (val !== undefined && typeof val !== "function") {
      clean[key] = sanitizePayload(val);
    }
  });
  return clean as T;
}

export function getCurrentUserUid(): string {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  if (cachedUid) return cachedUid;
  let sessionUid = localStorage.getItem("guest_session_uid");
  if (!sessionUid) {
    sessionUid = "session_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("guest_session_uid", sessionUid);
  }
  return sessionUid;
}

// Auth change listener
export function listenToAuth(callback: (user: UserAccount | null) => void) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        await firebaseUser.reload();
      } catch (e) {
        console.warn("Gagal reload user:", e);
      }
      const activeUser = auth.currentUser || firebaseUser;
      cachedUid = activeUser.uid;
      const defaultDisplayName = activeUser.displayName || (activeUser.email ? activeUser.email.split('@')[0] : "User");
      const isAdmin = firebaseUser.uid === "tL2vtXDWhXho5J5J0xPxofVtRho1" || firebaseUser.uid === "gIbkeiOdWINKMthEN7cPFEirky22";
      cachedUser = {
        email: firebaseUser.email || "",
        name: defaultDisplayName,
        role: isAdmin ? "ADMIN" : "VIEWER",
        roleName: isAdmin ? "Admin" : "Viewer",
        uid: firebaseUser.uid
      };
      callback(cachedUser);
    } else {
      cachedUid = null;
      cachedUser = null;
      callback(null);
    }
  });
}

// Sign Up user via Firebase Authentication ONLY (Do NOT save user profile data)
export async function signUpUser(
  email: string,
  password: string,
  name?: string,
  role: string = "ADMIN"
): Promise<{ userAccount?: UserAccount; isUnverified?: boolean; email?: string }> {
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) throw new Error("Email tidak boleh kosong");

  if (password.length < 6) {
    throw new Error("Sandi harus minimal 6 karakter");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, emailKey, password);
    const firebaseUser = userCredential.user;

    // Automatically create user document in Firestore "users" collection with timeout safeguard
    try {
      const userRole = (firebaseUser.uid === "tL2vtXDWhXho5J5J0xPxofVtRho1" || firebaseUser.uid === "gIbkeiOdWINKMthEN7cPFEirky22") ? "ADMIN" : "VIEWER";
      const userDocRef = doc(db, "users", firebaseUser.uid);
      
      const writePromise = setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email || emailKey,
        displayName: name ? name.trim() : (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"),
        role: userRole,
        createdAt: serverTimestamp()
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout penulisan data pengguna ke Firestore")), 4000)
      );

      await Promise.race([writePromise, timeoutPromise]);
    } catch (dbErr: any) {
      console.warn("Gagal atau timeout membuat dokumen pengguna di Firestore:", dbErr.message || dbErr);
    }

    if (name && name.trim()) {
      try {
        await updateProfile(firebaseUser, { displayName: name.trim() });
      } catch (authErr: any) {
        console.warn("Could not update auth displayName:", authErr.message || authErr);
      }
    }

    // Send email verification optionally in the background
    try {
      sendEmailVerification(firebaseUser).catch(e => console.warn("Background verification email error:", e));
    } catch (sendErr: any) {
      console.warn("Could not send verification email:", sendErr.message || sendErr);
    }

    const displayName = name?.trim() || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User");
    const isAdmin = firebaseUser.uid === "tL2vtXDWhXho5J5J0xPxofVtRho1" || firebaseUser.uid === "gIbkeiOdWINKMthEN7cPFEirky22";

    const userAccount: UserAccount = {
      email: firebaseUser.email || emailKey,
      name: displayName,
      role: isAdmin ? "ADMIN" : "VIEWER",
      roleName: isAdmin ? "Admin" : "Viewer",
      uid: firebaseUser.uid
    };

    cachedUid = userAccount.uid;
    cachedUser = userAccount;

    return {
      userAccount,
      isUnverified: false,
      email: userAccount.email
    };
  } catch (err: any) {
    let errorMsg = err.message || "Gagal mendaftarkan akun. Silakan coba lagi.";
    if (
      err.code === "auth/email-already-in-use" ||
      errorMsg.includes("already-in-use") ||
      errorMsg.includes("already in use") ||
      errorMsg.includes("already exists")
    ) {
      errorMsg = "Email sudah terdaftar. Silakan gunakan email lain atau masuk.";
    } else if (err.code === "auth/invalid-email" || errorMsg.includes("invalid-email")) {
      errorMsg = "Format email tidak valid.";
    } else if (err.code === "auth/weak-password" || errorMsg.includes("weak-password")) {
      errorMsg = "Sandi terlalu lemah (minimal 6 karakter).";
    } else if (err.code === "auth/network-request-failed") {
      errorMsg = "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    }

    const errorToThrow = new Error(errorMsg);
    (errorToThrow as any).code = err.code || "";
    throw errorToThrow;
  }
}

// Log In user via Firebase Auth ONLY
export async function loginUser(email: string, password: string): Promise<{ userAccount?: UserAccount; isUnverified?: boolean; email?: string }> {
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) throw new Error("Email cannot be empty");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, emailKey, password);
    let firebaseUser = userCredential.user;

    // Reload user to fetch updated emailVerified status
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        firebaseUser = auth.currentUser;
      } else {
        await firebaseUser.reload();
      }
    } catch (reloadErr) {
      console.warn("Could not reload user status:", reloadErr);
    }



    const displayName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User");

    // Check and automatically create missing user document in Firestore "users" collection
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        const userDocRole = (firebaseUser.uid === "tL2vtXDWhXho5J5J0xPxofVtRho1" || firebaseUser.uid === "gIbkeiOdWINKMthEN7cPFEirky22") ? "ADMIN" : "VIEWER";
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || emailKey,
          role: userDocRole,
          createdAt: serverTimestamp()
        });
        console.log(`Automatically synced missing user document for uid: ${firebaseUser.uid}`);
      }
    } catch (dbErr: any) {
      console.warn("Could not check/sync user document on login:", dbErr.message || dbErr);
    }

    const isAdmin = firebaseUser.uid === "tL2vtXDWhXho5J5J0xPxofVtRho1" || firebaseUser.uid === "gIbkeiOdWINKMthEN7cPFEirky22";

    const userAccount: UserAccount = {
      email: firebaseUser.email || emailKey,
      name: displayName,
      role: isAdmin ? "ADMIN" : "VIEWER",
      roleName: isAdmin ? "Admin" : "Viewer",
      uid: firebaseUser.uid
    };

    cachedUid = userAccount.uid;
    cachedUser = userAccount;
    return {
      userAccount,
      isUnverified: false,
      email: userAccount.email
    };
  } catch (err: any) {
    const errorToThrow = new Error(err.message || "Email or password is incorrect");
    (errorToThrow as any).code = err.code || "";
    throw errorToThrow;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
  cachedUid = null;
  cachedUser = null;
}

export async function resetUserPassword(email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) throw new Error("Email tidak boleh kosong");
  try {
    await sendPasswordResetEmail(auth, emailKey);
  } catch (err: any) {
    let errorMsg = err.message || "Gagal mengirim email reset password. Silakan coba lagi.";
    if (err.code === "auth/user-not-found" || errorMsg.includes("user-not-found")) {
      errorMsg = "Email tidak ditemukan.";
    } else if (err.code === "auth/invalid-email" || errorMsg.includes("invalid-email")) {
      errorMsg = "Format email tidak valid.";
    } else if (err.code === "auth/network-request-failed") {
      errorMsg = "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    }
    const errorToThrow = new Error(errorMsg);
    (errorToThrow as any).code = err.code || "";
    throw errorToThrow;
  }
}

export async function initializeDatabaseIfEmpty(): Promise<boolean> {
  const uid = getCurrentUserUid();
  if (!uid) return false;
  
  // Fast path: If there are no initial programs to seed, we do not need to query or initialize anything.
  if (initialPrograms.length === 0) {
    return true;
  }
  
  try {
    const q = query(collection(db, "programs"), where("uid", "==", uid));
    const snap = await getDocs(q);
    
    // Check if they have the old corporate dummy data topics
    let hasDummyData = false;
    snap.forEach((doc) => {
      const data = doc.data();
      if (data && (data.topic === "Benchmarking Konektivitas Pelabuhan (KIT Batang) ke China" || data.topic === "PMO perlintasan sebidang")) {
        hasDummyData = true;
      }
    });

    if (hasDummyData) {
      console.log("Dummy data detected, automatically purging it from application...");
      // Delete programs in parallel
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      
      // Get and delete logs in parallel
      const logSnap = await getDocs(query(collection(db, "logs"), where("uid", "==", uid)));
      await Promise.all(logSnap.docs.map(d => deleteDoc(d.ref)));
      console.log("Purge of dummy data completed successfully.");
    } else if (snap.empty) {
      console.log("Seeding initial corporate data for user:", cachedUser?.email);
      await forceResetDatabaseWithStandardCorporateData(uid);
    }
  } catch (err: any) {
    console.log("Warning: initializeDatabaseIfEmpty failed (offline mode):", err.message);
  }
  return true;
}

export async function getAllPrograms(_currentUserParam?: UserAccount | null): Promise<ProgramJob[]> {
  try {
    const [querySnapshot, userProgs] = await Promise.all([
      getDocs(collection(db, "programs")).catch(() => ({ docs: [] })),
      getPrograms().catch(() => [])
    ]);

    const progsMap = new Map<string, ProgramJob>();
    querySnapshot.docs?.forEach((docSnap) => {
      progsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ProgramJob);
    });

    userProgs.forEach((up) => {
      if (!progsMap.has(up.id)) {
        progsMap.set(up.id, {
          id: up.id,
          no: progsMap.size + 1,
          topic: up.topic || "Untitled Topic",
          subTopic: up.subTopic || "",
          cluster: (up.cluster as any) || "Strategic Transformation",
          owner: up.unitOwner || "DC",
          unitOwner: up.unitOwner || "DC",
          ztRole: "Orchestrator",
          strategicImpact: "",
          phase: up.phase || "Ideation",
          progress: up.progress || 0,
          statusTracker: (up.statusTracker as any) || "Green",
          currentMilestone: "",
          keyIssue: "",
          actionPlan: "",
          startDate: up.startDate || "",
          deadline: up.deadline || "",
          decisionNeeded: "No",
          dzIntervention: "",
          ztPic: up.ztPic || "",
          confidence: "Medium",
          strategicFit: "Medium",
          priority: (up.priority as any) || "Medium",
          notes: "",
          ...up
        } as unknown as ProgramJob);
      }
    });

    const progs = Array.from(progsMap.values());
    return progs.sort((a, b) => (a.no || 0) - (b.no || 0));
  } catch (err: any) {
    console.log("Warning: getAllPrograms failed (offline mode fallback):", err.message);
    return [];
  }
}

export async function getAllMeetingLogs(_currentUserParam?: UserAccount | null): Promise<MeetingLog[]> {
  try {
    const [querySnapshot, userLogs] = await Promise.all([
      getDocs(collection(db, "logs")).catch(() => ({ docs: [] })),
      getMeetingLogs().catch(() => [])
    ]);

    const logsMap = new Map<string, MeetingLog>();
    querySnapshot.docs?.forEach((docSnap) => {
      logsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as MeetingLog);
    });

    userLogs.forEach((ul) => {
      if (!logsMap.has(ul.id)) {
        logsMap.set(ul.id, {
          id: ul.id,
          programId: ul.id,
          programTitle: ul.title || "Meeting Decision",
          meetingDate: ul.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
          notes: ul.keyNotes || "",
          previousStatus: "Green",
          newStatus: "Green",
          previousProgress: 0,
          newProgress: 100,
          recordedBy: ul.attendees || "Executive Moderator",
          files: [],
          documentLink: ul.actionItems || "",
          ...ul
        } as unknown as MeetingLog);
      }
    });

    const meetingLogs = Array.from(logsMap.values());
    return meetingLogs.sort((a, b) => {
      const dateA = a.meetingDate || "";
      const dateB = b.meetingDate || "";
      return dateB.localeCompare(dateA);
    });
  } catch (err: any) {
    console.log("Warning: getAllMeetingLogs failed (offline mode fallback):", err.message);
    return [];
  }
}

export async function addNewProgram(
  program: Omit<ProgramJob, "id" | "no">, 
  nextNo?: number,
  currentUserParam?: UserAccount | null
): Promise<ProgramJob> {
  const user = currentUserParam !== undefined ? currentUserParam : cachedUser;
  const uid = auth.currentUser?.uid || user?.uid || getCurrentUserUid();

  let actualNo = nextNo;
  if (actualNo === undefined) {
    const currentProgs = await getAllPrograms();
    actualNo = currentProgs.length > 0 ? Math.max(...currentProgs.map(p => p.no)) + 1 : 1;
  }
  
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  
  const payload = sanitizePayload({
    ...program,
    no: actualNo,
    updatedAt: nowStr,
    uid: uid
  });
  
  try {
    // Write to users/{uid}/programs via dashboardService
    await addProgram({
      topic: program.topic,
      subTopic: program.subTopic || "",
      cluster: program.cluster || "Strategic Transformation",
      unitOwner: program.owner || program.unitOwner || "",
      priority: program.priority || "Medium",
      phase: program.phase || "Ideation",
      statusTracker: program.statusTracker || "Green",
      progress: program.progress || 0,
      ztPic: program.ztPic || "",
      startDate: program.startDate || "",
      deadline: program.deadline || ""
    }).catch(err => console.warn("addProgram background error:", err));

    const docRef = await addDoc(collection(db, "programs"), payload);
    return {
      id: docRef.id,
      ...payload
    } as ProgramJob;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "programs");
  }
}

export async function updateProgramAndLogMeeting(
  programId: string,
  updatedFields: Partial<ProgramJob>,
  logDetails: {
    notes: string;
    previousStatus: "Green" | "Yellow" | "Red" | "Blocked";
    newStatus: "Green" | "Yellow" | "Red" | "Blocked";
    previousProgress: number;
    newProgress: number;
    recordedBy: string;
    programTitle: string;
    files?: AttachmentFile[];
    documentLink?: string;
    meetingDate?: string;
  }
): Promise<void> {
  const uid = getCurrentUserUid();

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const meetingDate = logDetails.meetingDate || nowStr;
  const fieldsWithTime = sanitizePayload({
    ...updatedFields,
    updatedAt: nowStr
  });
  
  try {
    // Write meeting log to users/{uid}/meeting_logs via dashboardService
    await addMeetingLog({
      title: logDetails.programTitle || "Meeting Decision",
      date: meetingDate,
      unit: "ZT Cockpit",
      attendees: logDetails.recordedBy || "Executive Moderator",
      keyNotes: logDetails.notes || "",
      actionItems: logDetails.documentLink || ""
    }).catch(err => console.warn("addMeetingLog background error:", err));

    const progRef = doc(db, "programs", programId);
    await updateDoc(progRef, fieldsWithTime);
    
    const newLogRecord = sanitizePayload({
      programId,
      programTitle: logDetails.programTitle,
      meetingDate,
      notes: logDetails.notes,
      previousStatus: logDetails.previousStatus,
      newStatus: logDetails.newStatus,
      previousProgress: logDetails.previousProgress,
      newProgress: logDetails.newProgress,
      recordedBy: logDetails.recordedBy || "Executive Moderator",
      files: logDetails.files || [],
      documentLink: logDetails.documentLink || "",
      uid: uid
    });
    
    await addDoc(collection(db, "logs"), newLogRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `programs/${programId}`);
  }
}

export async function editMeetingLogAndSyncProgram(
  logId: string,
  logFields: {
    notes: string;
    recordedBy: string;
    meetingDate: string;
    newStatus: "Green" | "Yellow" | "Red" | "Blocked";
    newProgress: number;
    files?: AttachmentFile[];
    documentLink?: string;
    programId: string;
  }
): Promise<void> {
  const logRef = doc(db, "logs", logId);
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  
  const logPayload = sanitizePayload({
    notes: logFields.notes,
    recordedBy: logFields.recordedBy,
    meetingDate: logFields.meetingDate,
    newStatus: logFields.newStatus,
    newProgress: logFields.newProgress,
    files: logFields.files || [],
    documentLink: logFields.documentLink || ""
  });

  try {
    await updateDoc(logRef, logPayload);

    if (logFields.programId) {
      const progRef = doc(db, "programs", logFields.programId);
      await updateDoc(progRef, sanitizePayload({
        statusTracker: logFields.newStatus,
        progress: logFields.newProgress,
        updatedAt: nowStr
      }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `logs/${logId}`);
  }
}

export async function updateProgramFieldsOnly(
  programId: string,
  updatedFields: Partial<ProgramJob>
): Promise<void> {
  const meetingDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const fieldsWithTime = sanitizePayload({
    ...updatedFields,
    updatedAt: meetingDate
  });
  
  try {
    const progRef = doc(db, "programs", programId);
    await updateDoc(progRef, fieldsWithTime);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `programs/${programId}`);
  }
}

export async function deleteProgram(programId: string, programItem?: ProgramJob | null): Promise<void> {
  const uid = getCurrentUserUid();
  const pathsToDelete = new Set<string>();

  const extractAndAdd = (item: any) => {
    if (!item) return;
    if (typeof item === "string") {
      const p = extractStoragePath(item);
      if (p) pathsToDelete.add(p);
      return;
    }
    const candidatePaths = [
      item.storagePath,
      item.downloadURL,
      item.fileUrl,
      item.dataUrl,
      item.url,
      item.filePath
    ];
    for (const cp of candidatePaths) {
      const p = extractStoragePath(cp);
      if (p) pathsToDelete.add(p);
    }
    if (Array.isArray(item.files)) {
      item.files.forEach(extractAndAdd);
    }
    if (Array.isArray(item.attachmentFiles)) {
      item.attachmentFiles.forEach(extractAndAdd);
    }
  };

  if (programItem) {
    extractAndAdd(programItem);
  }

  try {
    const progRef = doc(db, "programs", programId);
    const progSnap = await getDoc(progRef);
    if (progSnap.exists()) {
      extractAndAdd(progSnap.data());
    }
  } catch (err) {
    console.warn("[deleteProgram] Program doc check before delete skip:", err);
  }

  const logDocRefs: any[] = [];
  try {
    const q1 = query(collection(db, "logs"), where("programId", "==", programId));
    const snap1 = await getDocs(q1).catch(() => null);
    if (snap1 && !snap1.empty) {
      snap1.docs.forEach((logDoc) => {
        logDocRefs.push(logDoc.ref);
        extractAndAdd(logDoc.data());
      });
    }

    if (uid) {
      const userMeetingLogsRef = collection(db, "users", uid, "meeting_logs");
      const qUserLogs = query(userMeetingLogsRef, where("programId", "==", programId));
      const snapUserLogs = await getDocs(qUserLogs).catch(() => null);
      if (snapUserLogs && !snapUserLogs.empty) {
        snapUserLogs.docs.forEach((uLog) => {
          logDocRefs.push(uLog.ref);
          extractAndAdd(uLog.data());
        });
      }
    }
  } catch (err) {
    console.warn("[deleteProgram] Query logs error:", err);
  }

  for (const normalizedPath of pathsToDelete) {
    try {
      const fileRef = ref(storage, normalizedPath);
      await deleteObject(fileRef);
      console.log(`[Program Storage Deleted Successfully]: ${normalizedPath}`);
    } catch (err) {
      console.error("[Program Storage Delete Error]:", err);
    }
  }

  const deletePromises: Promise<any>[] = logDocRefs.map((lRef) =>
    deleteDoc(lRef).catch((err) => console.warn("delete log doc error:", err))
  );

  const progRef = doc(db, "programs", programId);
  deletePromises.push(
    deleteDoc(progRef).catch((err) => console.warn("delete program doc error:", err))
  );

  deletePromises.push(
    deleteDashboardProgram(programId).catch((err) => console.warn("deleteDashboardProgram skip:", err))
  );

  await Promise.all(deletePromises);
}

export async function getAllCloudDocuments(_currentUserParam?: UserAccount | null): Promise<CloudDocument[]> {
  try {
    const [querySnapshot, userDocs] = await Promise.all([
      getDocs(collection(db, "documents")).catch(() => ({ docs: [] })),
      getDocuments().catch(() => [])
    ]);

    const docsMap = new Map<string, CloudDocument>();
    querySnapshot.docs?.forEach((docSnap) => {
      docsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as CloudDocument);
    });

    userDocs.forEach((ud) => {
      if (!docsMap.has(ud.id)) {
        docsMap.set(ud.id, {
          id: ud.id,
          tanggalSurat: ud.createdAt ? String(ud.createdAt).substring(0, 10) : new Date().toISOString().substring(0, 10),
          noSurat: ud.title || "DOC-001",
          asalSurat: ud.category || "General",
          prihal: ud.title || "General Document",
          uploadedBy: ud.owner || ud.createdBy || "Executive Moderator",
          createdAt: ud.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 16),
          files: ud.downloadURL ? [{
            name: ud.title || "Document",
            type: ud.fileType || "application/octet-stream",
            size: parseFloat(ud.fileSize) || 1024,
            dataUrl: ud.downloadURL
          }] : [],
          storagePath: ud.storagePath,
          downloadURL: ud.downloadURL,
          ...ud
        } as unknown as CloudDocument);
      }
    });

    const docs = Array.from(docsMap.values());
    return docs.sort((a, b) => {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      return dateB.localeCompare(dateA);
    });
  } catch (err: any) {
    console.log("Warning: getAllCloudDocuments failed (offline mode fallback):", err.message);
    return [];
  }
}// Helper to extract relative Storage Path from relative string or full Firebase Storage URL
export function extractStoragePath(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  const str = String(pathOrUrl).trim();
  if (!str || str.startsWith("data:")) return null;

  if (str.startsWith("http://") || str.startsWith("https://")) {
    try {
      const url = new URL(str);
      if (url.pathname.includes("/o/")) {
        const rawPath = url.pathname.split("/o/")[1];
        if (rawPath) {
          const cleanRaw = rawPath.split("?")[0];
          return decodeURIComponent(cleanRaw);
        }
      }
      const decodedPathname = decodeURIComponent(url.pathname);
      if (decodedPathname.includes("user_uploads/")) {
        const idx = decodedPathname.indexOf("user_uploads/");
        return decodedPathname.substring(idx);
      }
    } catch (e) {
      console.warn("[extractStoragePath] Failed to parse URL:", e);
    }
    return null;
  }

  return str;
}

export async function addNewCloudDocument(docFields: Omit<CloudDocument, "id">): Promise<CloudDocument> {
  const uid = getCurrentUserUid();

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const cleanFiles = (docFields.files || []).map((f) => {
    const sPath = String(f.storagePath || extractStoragePath(f.downloadURL || f.dataUrl) || "");
    const dUrl = String(f.downloadURL || f.dataUrl || "");
    return {
      name: String(f.name || "Document"),
      type: String(f.type || "application/octet-stream"),
      size: Number(f.size) || 0,
      storagePath: sPath,
      downloadURL: dUrl,
      dataUrl: dUrl
    };
  });

  const seenKeys = new Set<string>();
  const uniqueFiles: typeof cleanFiles = [];
  for (const f of cleanFiles) {
    const key = f.storagePath || f.downloadURL || f.name;
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueFiles.push(f);
    }
  }

  const topStoragePath = String(
    docFields.storagePath || 
    (uniqueFiles[0] ? uniqueFiles[0].storagePath : "") || 
    ""
  );
  const topDownloadURL = String(
    docFields.downloadURL || 
    (uniqueFiles[0] ? uniqueFiles[0].downloadURL || uniqueFiles[0].dataUrl : "") || 
    ""
  );

  const payload = sanitizePayload({
    ...docFields,
    files: uniqueFiles,
    storagePath: topStoragePath,
    downloadURL: topDownloadURL,
    createdAt: nowStr,
    uid: uid
  });

  try {
    const docRef = await addDoc(collection(db, "documents"), payload);
    return {
      id: docRef.id,
      ...payload
    } as CloudDocument;
  } catch (error) {
    console.error("[Firestore error - addNewCloudDocument]:", error);
    handleFirestoreError(error, OperationType.CREATE, "documents");
  }
}

export async function deleteCloudDocument(docId: string, docItem?: CloudDocument | null): Promise<void> {
  const uid = getCurrentUserUid();
  const docRef = doc(db, "documents", docId);
  const pathsToDelete = new Set<string>();

  const extractAndAdd = (item: any) => {
    if (!item) return;
    if (typeof item === "string") {
      const p = extractStoragePath(item);
      if (p) pathsToDelete.add(p);
      return;
    }
    const candidatePaths = [
      item.storagePath,
      item.downloadURL,
      item.fileUrl,
      item.dataUrl,
      item.url,
      item.filePath
    ];
    for (const cp of candidatePaths) {
      const p = extractStoragePath(cp);
      if (p) pathsToDelete.add(p);
    }
    if (Array.isArray(item.files)) {
      item.files.forEach(extractAndAdd);
    }
  };

  if (docItem) {
    extractAndAdd(docItem);
  }

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      extractAndAdd(docSnap.data());
    }
  } catch (err) {
    console.warn("[Arsip Dokumen] Firestore check before delete skip:", err);
  }

  if (uid) {
    try {
      const userDocRef = doc(db, "users", uid, "documents", docId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        extractAndAdd(userDocSnap.data());
      }
    } catch (err) {
      console.warn("[Arsip Dokumen] User doc check before delete skip:", err);
    }
  }

  for (const normalizedPath of pathsToDelete) {
    try {
      const fileRef = ref(storage, normalizedPath);
      await deleteObject(fileRef);
      console.log("[Storage Delete Success]:", normalizedPath);
    } catch (err) {
      console.error("[Arsip Dokumen Storage Delete Error]:", err);
    }
  }

  await Promise.all([
    deleteDoc(docRef).catch((err) => console.warn("deleteDoc documents error:", err)),
    deleteDashboardDocument(docId).catch((err) => console.warn("deleteDashboardDocument skip:", err))
  ]);
}

export async function clearAllProgramsAndLogs(): Promise<void> {
  const uid = getCurrentUserUid();
  if (!uid) return;

  const [progSnap, logSnap] = await Promise.all([
    getDocs(query(collection(db, "programs"), where("uid", "==", uid))),
    getDocs(query(collection(db, "logs"), where("uid", "==", uid)))
  ]);

  await Promise.all([
    ...progSnap.docs.map(d => deleteDoc(d.ref)),
    ...logSnap.docs.map(d => deleteDoc(d.ref))
  ]);
}

export async function forceResetDatabaseWithStandardCorporateData(targetUid?: string): Promise<void> {
  const uid = targetUid || getCurrentUserUid();
  if (!uid) return;

  // Clear existing programs and logs for this user in Firestore in parallel
  const [progSnap, logSnap] = await Promise.all([
    getDocs(query(collection(db, "programs"), where("uid", "==", uid))),
    getDocs(query(collection(db, "logs"), where("uid", "==", uid)))
  ]);

  await Promise.all([
    ...progSnap.docs.map(d => deleteDoc(d.ref)),
    ...logSnap.docs.map(d => deleteDoc(d.ref))
  ]);

  // Create clean initial programs in parallel
  const programsBatch = initialPrograms.map((p, idx) => ({
    ...p,
    uid: uid,
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
  }));
  
  await Promise.all(programsBatch.map(p => {
    return addDoc(collection(db, "programs"), p);
  }));

  // Create clean initial logs in parallel
  const logsBatch = initialLogs.map((l, idx) => ({
    ...l,
    uid: uid,
    meetingDate: l.meetingDate || new Date().toISOString().replace('T', ' ').substring(0, 16)
  }));

  await Promise.all(logsBatch.map(l => {
    return addDoc(collection(db, "logs"), l);
  }));
}

export async function getAllUsersForAdmin(): Promise<any[]> {
  const uid = getCurrentUserUid();
  if (!uid) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({ id: docSnap.id, uid: data.uid || docSnap.id, ...data });
    });
    return users;
  } catch (err: any) {
    console.log("Warning: getAllUsersForAdmin failed:", err.message);
    return [];
  }
}

export function subscribeUsersForAdmin(callback: (users: any[]) => void) {
  try {
    const usersRef = collection(db, "users");
    return onSnapshot(usersRef, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          ...data
        });
      });
      callback(users);
    }, (err) => {
      console.warn("Warning: subscribeUsersForAdmin error:", err.message);
    });
  } catch (err: any) {
    console.warn("Warning: subscribeUsersForAdmin failed:", err.message);
    return () => {};
  }
}

export async function getAllProgramsForAdmin(): Promise<ProgramJob[]> {
  const uid = getCurrentUserUid();
  if (!uid) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "programs"));
    const progs: ProgramJob[] = [];
    querySnapshot.forEach((doc) => {
      progs.push({ id: doc.id, ...doc.data() } as ProgramJob);
    });
    return progs;
  } catch (err: any) {
    console.log("Warning: getAllProgramsForAdmin failed:", err.message);
    return [];
  }
}

export async function getAllMeetingLogsForAdmin(): Promise<MeetingLog[]> {
  const uid = getCurrentUserUid();
  if (!uid) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "logs"));
    const meetingLogs: MeetingLog[] = [];
    querySnapshot.forEach((doc) => {
      meetingLogs.push({ id: doc.id, ...doc.data() } as MeetingLog);
    });
    return meetingLogs;
  } catch (err: any) {
    console.log("Warning: getAllMeetingLogsForAdmin failed:", err.message);
    return [];
  }
}

export async function getAllCloudDocumentsForAdmin(): Promise<CloudDocument[]> {
  const uid = getCurrentUserUid();
  if (!uid) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "documents"));
    const docs: CloudDocument[] = [];
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...doc.data() } as CloudDocument);
    });
    return docs;
  } catch (err: any) {
    console.log("Warning: getAllCloudDocumentsForAdmin failed:", err.message);
    return [];
  }
}

// ==========================================
// USER SPECIFIC DATA
// ==========================================

export async function ensureUserProfile(uid: string, displayName: string, email: string): Promise<void> {
  if (!uid) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      displayName: displayName || (email ? email.split('@')[0] : "User"),
      email: email || "",
      plan: "Pro Plan",
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn("ensureUserProfile warning:", err.message || err);
  }
}


