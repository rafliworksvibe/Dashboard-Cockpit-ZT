import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
import { auth, db, storage } from "../firebase";
import { ProgramItem, MeetingLogItem, DocumentItem } from "../types/dashboard";

const getCurrentUid = (): string => {
  const uid = auth.currentUser?.uid || localStorage.getItem("guest_session_uid") || localStorage.getItem("last_active_uid");
  if (!uid) {
    const newGuestUid = "guest_" + Date.now().toString(36);
    localStorage.setItem("guest_session_uid", newGuestUid);
    return newGuestUid;
  }
  return uid;
};

// --------------------------------------------------
// PROGRAM TRACKER
// --------------------------------------------------
export const addProgram = async (data: Omit<ProgramItem, "id" | "createdBy" | "createdAt">): Promise<ProgramItem> => {
  const uid = getCurrentUid();
  const payload = {
    ...data,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "users", uid, "programs"), payload);
  return { id: docRef.id, ...payload } as ProgramItem;
};

export const getPrograms = async (): Promise<ProgramItem[]> => {
  const uid = getCurrentUid();
  const colRef = collection(db, "users", uid, "programs");
  try {
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ProgramItem[];
  } catch (err) {
    console.warn("Ordered getPrograms failed, falling back to unordered query:", err);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ProgramItem[];
  }
};

export const deleteProgram = async (id: string): Promise<void> => {
  const uid = getCurrentUid();
  await deleteDoc(doc(db, "users", uid, "programs", id));
};

// --------------------------------------------------
// MEETING LOGS
// --------------------------------------------------
export const addMeetingLog = async (data: Omit<MeetingLogItem, "id" | "createdBy" | "createdAt">): Promise<MeetingLogItem> => {
  const uid = getCurrentUid();
  const payload = {
    ...data,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "users", uid, "meeting_logs"), payload);
  return { id: docRef.id, ...payload } as MeetingLogItem;
};

export const getMeetingLogs = async (): Promise<MeetingLogItem[]> => {
  const uid = getCurrentUid();
  const colRef = collection(db, "users", uid, "meeting_logs");
  try {
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MeetingLogItem[];
  } catch (err) {
    console.warn("Ordered getMeetingLogs failed, falling back to unordered query:", err);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MeetingLogItem[];
  }
};

export const deleteMeetingLog = async (id: string): Promise<void> => {
  const uid = getCurrentUid();
  await deleteDoc(doc(db, "users", uid, "meeting_logs", id));
};

// --------------------------------------------------
// ARSIP DOKUMEN (WITH FILE UPLOAD)
// --------------------------------------------------
export const uploadAndAddDocument = (
  file: File,
  metadata: { title: string; category: string; owner: string },
  onProgress: (progress: number) => void
): Promise<DocumentItem> => {
  return new Promise((resolve, reject) => {
    try {
      const uid = getCurrentUid();
      const uniqueName = `${Date.now()}_${file.name}`;
      const storagePath = `user_uploads/documents/${uniqueName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        },
        (err) => reject(err),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const payload = {
              title: metadata.title || file.name,
              category: metadata.category || "Umum",
              owner: metadata.owner || "Internal",
              fileType: file.type || "application/octet-stream",
              fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              storagePath,
              downloadURL,
              createdBy: uid,
              createdAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "users", uid, "documents"), payload);
            resolve({ id: docRef.id, ...payload });
          } catch (err) {
            reject(err);
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });
};

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const uid = getCurrentUid();
  const colRef = collection(db, "users", uid, "documents");
  try {
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentItem[];
  } catch (err) {
    console.warn("Ordered getDocuments failed, falling back to unordered query:", err);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentItem[];
  }
};

import { extractStoragePath } from "../dataService";

export const deleteDocument = async (documentOrId: string | DocumentItem): Promise<void> => {
  const uid = getCurrentUid();
  const docId = typeof documentOrId === "string" ? documentOrId : documentOrId.id;
  const passedDoc = typeof documentOrId === "object" ? documentOrId : null;

  const docRef = doc(db, "users", uid, "documents", docId);
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

  if (passedDoc) {
    extractAndAdd(passedDoc);
  }

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      extractAndAdd(snap.data());
    }
  } catch (e) {
    console.warn("[Arsip Dokumen] Check storagePath failed:", e);
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

  await deleteDoc(docRef).catch((err) => console.warn("deleteDoc dashboard document error:", err));
};
