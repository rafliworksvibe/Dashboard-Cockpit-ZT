import { useState, useEffect, useMemo, useRef } from "react";
import { safeStorage } from "./safeStorage";
import { 
  getAllPrograms, 
  getAllMeetingLogs, 
  initializeDatabaseIfEmpty, 
  addNewProgram, 
  updateProgramAndLogMeeting,
  editMeetingLogAndSyncProgram,
  updateProgramFieldsOnly,
  deleteProgram,
  getAllCloudDocuments,
  addNewCloudDocument,
  deleteCloudDocument,
  forceResetDatabaseWithStandardCorporateData,
  clearAllProgramsAndLogs,
  listenToAuth,
  logoutUser,
  getAllUsersForAdmin,
  subscribeUsersForAdmin,
  getAllProgramsForAdmin,
  getAllMeetingLogsForAdmin,
  getAllCloudDocumentsForAdmin,
  getCurrentUserUid
} from "./dataService";
import { auth } from "./firebase";
import { checkIsAdmin, ADMIN_UID } from "./utils/rbac";
import { ProgramJob, MeetingLog, CloudDocument, UserAccount, AttachmentFile } from "./types";
import DashboardView from "./components/DashboardView";
import AdminDashboardView from "./components/AdminDashboardView";
import ProgramTrackerView from "./components/ProgramTrackerView";
import MeetingLogsView from "./components/MeetingLogsView";
import CloudDocumentsView from "./components/CloudDocumentsView";
import AddProgramModal from "./components/AddProgramModal";
import MeetingLogModal from "./components/MeetingLogModal";
import EditProgramModal from "./components/EditProgramModal";
import AuthView from "./components/AuthView";
import { 
  LayoutDashboard, 
  ListTodo, 
  History, 
  FolderSync, 
  Briefcase, 
  Activity, 
  HelpCircle,
  CloudLightning,
  LogOut,
  Shield,
  Trash2,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight
} from "lucide-react";


export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "my_files" | "my_notes" | "team_members" | "tracker" | "logs" | "cloud_docs" | "admin_panel">("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoHideEnabled, setIsAutoHideEnabled] = useState(true);
  const [programs, setPrograms] = useState<ProgramJob[]>([]);
  const [logs, setLogs] = useState<MeetingLog[]>([]);
  const [documents, setDocuments] = useState<CloudDocument[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<string>("Menghubungkan ke Database Cloud...");
  const [dataError, setDataError] = useState<string | null>(null);

  // Synchronize Auth Session with Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = listenToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        if (checkIsAdmin(user)) {
          setActiveTab("admin_panel");
        } else {
          setActiveTab("dashboard");
        }
        loadData(user);
      } else {
        setPrograms([]);
        setLogs([]);
        setDocuments([]);
        setIsLoading(false);
        setDbStatus("Silakan Masuk");
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time synchronization for users list when admin is logged in
  useEffect(() => {
    if (currentUser && (currentUser.role === "ADMIN" || checkIsAdmin(currentUser))) {
      const unsubUsers = subscribeUsersForAdmin((fetchedUsers) => {
        setUsersList(fetchedUsers);
        localStorage.setItem(`cache_users_${currentUser.uid}`, JSON.stringify(fetchedUsers));
      });
      return () => unsubUsers();
    }
  }, [currentUser?.uid, currentUser?.role]);


  // Modal control states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramJob | null>(null);
  const [selectedProgramForEdit, setSelectedProgramForEdit] = useState<ProgramJob | null>(null);
  const [logToEdit, setLogToEdit] = useState<MeetingLog | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Menutup dropdown saat mengeklik di luar area tombol
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("Gagal keluar:", e);
    }
  };

  // Initialize and load application data on startup from Firestore
  const loadData = async (userParam?: UserAccount | null) => {
    const activeUser = userParam !== undefined ? userParam : currentUser;
    const uid = activeUser?.uid;
    const isAdminUser = checkIsAdmin(activeUser);
    
    // 1. Instantly load from localStorage cache so there is 0ms delay / no blank loading spinner
    if (uid) {
      try {
        const cachedProgs = localStorage.getItem(`cache_programs_${uid}`);
        const cachedLogs = localStorage.getItem(`cache_logs_${uid}`);
        const cachedDocs = localStorage.getItem(`cache_docs_${uid}`);
        const cachedUsers = localStorage.getItem(`cache_users_${uid}`);
        
        if (cachedProgs) setPrograms(JSON.parse(cachedProgs));
        if (cachedLogs) setLogs(JSON.parse(cachedLogs));
        if (cachedDocs) setDocuments(JSON.parse(cachedDocs));
        if (cachedUsers) setUsersList(JSON.parse(cachedUsers));
        
        if (cachedProgs) {
          setIsLoading(false);
          setDbStatus("Database Cloud Aktif");
        }
      } catch (cacheErr) {
        console.warn("Gagal memuat cache lokal:", cacheErr);
      }
    }

    setDbStatus("Sinkronisasi dengan Cloud Firestore...");
    try {
      if (isAdminUser) {
        let hasFetchError = false;
        // Fetch ALL collections in parallel for the Admin view, catching individual errors
        const [fetchedUsers, fetchedPrograms, fetchedLogs, fetchedDocs] = await Promise.all([
          getAllUsersForAdmin().catch((err) => {
            console.error("Gagal memuat daftar pengguna:", err);
            hasFetchError = true;
            return [];
          }),
          getAllProgramsForAdmin().catch((err) => {
            console.error("Gagal memuat program:", err);
            hasFetchError = true;
            return [];
          }),
          getAllMeetingLogsForAdmin().catch((err) => {
            console.error("Gagal memuat catatan pertemuan:", err);
            hasFetchError = true;
            return [];
          }),
          getAllCloudDocumentsForAdmin().catch((err) => {
            console.error("Gagal memuat dokumen cloud:", err);
            hasFetchError = true;
            return [];
          })
        ]);
        
        setUsersList(fetchedUsers);
        setPrograms(fetchedPrograms);
        setLogs(fetchedLogs);
        setDocuments(fetchedDocs);
        
        if (hasFetchError) {
          setDataError("Gagal menyinkronkan beberapa koleksi Firestore (Missing or insufficient permissions). Beberapa visual atau daftar mungkin menampilkan data kosong.");
        } else {
          setDataError(null);
        }
        
        // Save to cache for instant future loads
        localStorage.setItem(`cache_users_${uid}`, JSON.stringify(fetchedUsers));
        localStorage.setItem(`cache_programs_${uid}`, JSON.stringify(fetchedPrograms));
        localStorage.setItem(`cache_logs_${uid}`, JSON.stringify(fetchedLogs));
        localStorage.setItem(`cache_docs_${uid}`, JSON.stringify(fetchedDocs));
      } else {
        // 2. Fetch all collections in parallel for optimal network speed
        let [fetchedPrograms, fetchedLogs, fetchedDocs] = await Promise.all([
          getAllPrograms(activeUser).catch((err) => {
            console.error("Gagal memuat program:", err);
            return [];
          }),
          getAllMeetingLogs(activeUser).catch((err) => {
            console.error("Gagal memuat catatan pertemuan:", err);
            return [];
          }),
          getAllCloudDocuments(activeUser).catch((err) => {
            console.error("Gagal memuat dokumen cloud:", err);
            return [];
          })
        ]);
        
        // 3. Seed default corporate data only if empty and we haven't seeded yet
        if (fetchedPrograms.length === 0 && uid) {
          const seedKey = `db_seeded_${uid}`;
          if (localStorage.getItem(seedKey) !== "true") {
            setDbStatus("Membuat data awal korporat...");
            await forceResetDatabaseWithStandardCorporateData(uid).catch(err => {
              console.error("Gagal seeding data korporat awal:", err);
            });
            localStorage.setItem(seedKey, "true");
            
            // Re-fetch clean corporate starter data
            [fetchedPrograms, fetchedLogs, fetchedDocs] = await Promise.all([
              getAllPrograms(activeUser).catch(() => []),
              getAllMeetingLogs(activeUser).catch(() => []),
              getAllCloudDocuments(activeUser).catch(() => [])
            ]);
          }
        }
        
        setPrograms(fetchedPrograms);
        setLogs(fetchedLogs);
        setDocuments(fetchedDocs);
        
        // 4. Save to cache for instant future loads
        if (uid) {
          localStorage.setItem(`cache_programs_${uid}`, JSON.stringify(fetchedPrograms));
          localStorage.setItem(`cache_logs_${uid}`, JSON.stringify(fetchedLogs));
          localStorage.setItem(`cache_docs_${uid}`, JSON.stringify(fetchedDocs));
          localStorage.setItem(`db_seeded_${uid}`, "true");
        }
      }
      
      setDbStatus("Database Cloud Aktif");
    } catch (error: any) {
      console.error("Error loading application data:", error);
      setDbStatus("Gagal Memuat Data Cloud");
      setDataError(error.message || "Terjadi kesalahan saat menyinkronkan data dengan Cloud Firestore.");
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically close any active details or modals when navigating between tabs
  useEffect(() => {
    setIsAddModalOpen(false);
    setIsUpdateModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedProgram(null);
    setSelectedProgramForEdit(null);
  }, [activeTab]);

  // Form Submission Handler: Insert new Job Program
  const handleAddProgram = async (newProgFields: Omit<ProgramJob, "id" | "no">) => {
    const activeUid = auth.currentUser?.uid || currentUser?.uid || getCurrentUserUid();
    const tempId = "temp_" + Date.now().toString(36);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const optimisticProgram: ProgramJob = {
      ...newProgFields,
      id: tempId,
      no: programs.length + 1,
      updatedAt: nowStr,
      uid: activeUid,
    };

    // Store previous programs for fallback in case of write failure
    const previousPrograms = [...programs];

    // Optimistically insert the new program into UI immediately
    setPrograms((prev) => [...prev, optimisticProgram]);

    try {
      const realProgram = await addNewProgram(newProgFields, optimisticProgram.no, currentUser);
      // Replace the temporary program with the real program that has the server ID
      setPrograms((prev) => {
        const updated = prev.map((p) => (p.id === tempId ? (realProgram || { ...optimisticProgram, id: tempId }) : p));
        if (activeUid) {
          localStorage.setItem(`cache_programs_${activeUid}`, JSON.stringify(updated));
        }
        return updated;
      });
      
      // Perform silent background data load to ensure everything is perfectly in sync with server
      loadData().catch((err) => console.log("Silent sync warning:", err));
    } catch (error) {
      console.error("[handleAddProgram Firestore Error]:", error);
      alert("Gagal menambahkan program baru ke cloud. Mengembalikan data...");
      setPrograms(previousPrograms);
    }
  };

  // Log Update & Record Meeting Decisions Handler
  const handleUpdateProgramAndLog = async (
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
  ) => {
    const activeUid = auth.currentUser?.uid || currentUser?.uid || getCurrentUserUid();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const tempLogId = "temp_log_" + Date.now().toString(36);
    const optimisticLog: MeetingLog = {
      id: tempLogId,
      programId,
      programTitle: logDetails.programTitle,
      meetingDate: logDetails.meetingDate || nowStr,
      notes: logDetails.notes,
      previousStatus: logDetails.previousStatus,
      newStatus: logDetails.newStatus,
      previousProgress: logDetails.previousProgress,
      newProgress: logDetails.newProgress,
      recordedBy: logDetails.recordedBy || currentUser?.name || "Executive Moderator",
      files: logDetails.files || [],
      documentLink: logDetails.documentLink || "",
      uid: activeUid,
    };

    // Save previous states for fallback
    const previousPrograms = [...programs];
    const previousLogs = [...logs];

    // Optimistically update program details and insert meeting log instantly
    setPrograms((prev) =>
      prev.map((p) => (p.id === programId ? { ...p, ...updatedFields, updatedAt: nowStr } : p))
    );
    setLogs((prev) => [optimisticLog, ...prev]);

    try {
      await updateProgramAndLogMeeting(programId, updatedFields, logDetails);
      // Perform silent background reload to fetch real IDs & fully sync from server
      loadData().catch((err) => console.log("Silent sync warning:", err));
    } catch (error) {
      console.error("[handleAddLog / updateProgramAndLog Firestore Error]:", error);
      alert("Gagal memperbarui program di cloud. Mengembalikan data...");
      setPrograms(previousPrograms);
      setLogs(previousLogs);
    }
  };

  // Handle editing of an existing meeting log
  const handleEditMeetingLog = async (
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
  ) => {
    const previousPrograms = [...programs];
    const previousLogs = [...logs];
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Optimistically update logs local state
    setLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              notes: logFields.notes,
              recordedBy: logFields.recordedBy,
              meetingDate: logFields.meetingDate,
              newStatus: logFields.newStatus,
              newProgress: logFields.newProgress,
              files: logFields.files || [],
              documentLink: logFields.documentLink || "",
            }
          : l
      )
    );

    // Optimistically update programs local state
    if (logFields.programId) {
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === logFields.programId
            ? {
                ...p,
                statusTracker: logFields.newStatus,
                progress: logFields.newProgress,
                updatedAt: nowStr,
              }
            : p
        )
      );
    }

    try {
      await editMeetingLogAndSyncProgram(logId, logFields);
      // Background reload to ensure exact server consistency
      loadData().catch((err) => console.log("Silent sync warning:", err));
    } catch (error) {
      console.error("[handleEditMeetingLog Error]:", error);
      alert("Gagal mengedit catatan meeting di cloud. Mengembalikan data...");
      setPrograms(previousPrograms);
      setLogs(previousLogs);
    }
  };

  // Inline rapid updates for spreadsheet fields
  const handleInlineUpdate = async (programId: string, updatedFields: Partial<ProgramJob>) => {
    // Optimistic local state update to ensure UI response is instant and lag-free
    setPrograms(prev => prev.map(p => p.id === programId ? { ...p, ...updatedFields } : p));
    try {
      await updateProgramFieldsOnly(programId, updatedFields);
    } catch (error) {
      console.error("Gagal melakukan inline update program:", error);
      const fetchedPrograms = await getAllPrograms();
      setPrograms(fetchedPrograms);
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    // Save previous state for fallback in case of errors
    const previousPrograms = [...programs];
    const previousLogs = [...logs];
    const programToDelete = programs.find((p) => p.id === programId);

    // Optimistically update React state instantly (highly fluid and responsive)
    setPrograms((prev) => prev.filter((p) => p.id !== programId));
    setLogs((prev) => prev.filter((l) => l.programId !== programId));

    try {
      await deleteProgram(programId, programToDelete);
    } catch (error) {
      console.error("Gagal menghapus program:", error);
      alert("Gagal menghapus program dari cloud. Mengembalikan data...");
      // Revert back to original state on failure
      setPrograms(previousPrograms);
      setLogs(previousLogs);
    }
  };

  const handleAddDocument = async (docFields: Omit<CloudDocument, "id">) => {
    const activeUid = auth.currentUser?.uid || currentUser?.uid || getCurrentUserUid();
    const tempDocId = "temp_doc_" + Date.now().toString(36);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const optimisticDoc: CloudDocument = {
      ...docFields,
      id: tempDocId,
      createdAt: nowStr,
      uploadedBy: currentUser?.name || "Executive Moderator",
      uid: activeUid,
    };

    // Save previous documents for fallback
    const previousDocs = [...documents];

    // Optimistically prepend the new document to the UI
    setDocuments((prev) => [optimisticDoc, ...prev]);

    try {
      const realDoc = await addNewCloudDocument(docFields);
      // Replace temporary ID document with the real document
      setDocuments((prev) => prev.map((d) => (d.id === tempDocId ? (realDoc || { ...optimisticDoc, id: tempDocId }) : d)));
      
      // Silent background refresh
      loadData().catch((err) => console.log("Silent sync warning:", err));
    } catch (error) {
      console.error("[handleAddDocument Firestore Error]:", error);
      alert("Gagal mengarsipkan dokumen ke cloud. Mengembalikan data...");
      setDocuments(previousDocs);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    // Save previous state for fallback in case of errors
    const previousDocs = [...documents];
    const docToDelete = documents.find((d) => d.id === docId);

    // Optimistically update React state instantly
    setDocuments((prev) => prev.filter((d) => d.id !== docId));

    try {
      await deleteCloudDocument(docId, docToDelete);
    } catch (error) {
      console.error("Gagal menghapus dokumen:", error);
      alert("Gagal menghapus dokumen dari cloud. Mengembalikan data...");
      // Revert back to original state on failure
      setDocuments(previousDocs);
    }
  };

  // Trigger modal helper for specific job updates
  const handleOpenUpdateModal = (program: ProgramJob) => {
    setSelectedProgram(program);
    setIsUpdateModalOpen(true);
  };

  const handleOpenEditModal = (program: ProgramJob) => {
    setSelectedProgramForEdit(program);
    setIsEditModalOpen(true);
  };

  const handleUpdateProgramFields = async (programId: string, updatedFields: Partial<ProgramJob>) => {
    // Save previous state for fallback
    const previousPrograms = [...programs];

    // Optimistically update programs state instantly
    setPrograms((prev) =>
      prev.map((p) => (p.id === programId ? { ...p, ...updatedFields } : p))
    );

    try {
      await updateProgramFieldsOnly(programId, updatedFields);
      // Silent background sync
      loadData().catch((err) => console.log("Silent sync warning:", err));
    } catch (error) {
      console.error("Gagal memperbarui detail program:", error);
      alert("Gagal memperbarui program di cloud. Mengembalikan data...");
      setPrograms(previousPrograms);
    }
  };

  const handleForceResetStandardData = async () => {
    if (currentUser?.role !== "ADMIN") {
      alert("Akses Dibatasi: Hanya peran Admin yang dapat menyetel ulang database.");
      return;
    }

    if (confirm("Apakah Anda yakin ingin menyetel ulang database ke 29 program standar ZT Cockpit Hub? Tindakan ini akan menghapus semua program & log kustom Anda.")) {
      setIsLoading(true);
      try {
        await forceResetDatabaseWithStandardCorporateData();
        await loadData();
        alert("Database berhasil disetel ulang ke 29 program standar!");
      } catch (error) {
        console.error("Gagal menyetel ulang database:", error);
        alert("Gagal menyetel ulang database. Silakan periksa koneksi Anda.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClearAllPrograms = async () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh data program tracker yang ada? Tindakan ini tidak dapat dibatalkan.")) {
      setIsLoading(true);
      try {
        await clearAllProgramsAndLogs();
        await loadData();
        alert("Seluruh data program tracker berhasil dihapus!");
      } catch (error) {
        console.error("Gagal menghapus seluruh data program tracker:", error);
        alert("Gagal menghapus data. Silakan periksa koneksi Anda.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!currentUser) {
    return <AuthView onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f8] flex flex-col text-slate-900 font-sans selection:bg-[#f36e21] selection:text-white">
      
      {/* 1. Global Executive Header (Full Width Corporate Header without middle nav) */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 border-t-4 border-[#f36e21] shadow-sm px-2.5 sm:px-6 md:px-8 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand/logo and Title Section */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/5/56/Logo_PT_Kereta_Api_Indonesia_%28Persero%29_2020.svg" 
            alt="KAI Logo" 
            className="h-5 sm:h-7 w-auto object-contain shrink-0" 
            referrerPolicy="no-referrer"
          />
          <div className="h-4 sm:h-5 w-px bg-slate-200 hidden xs:block shrink-0" />
          <div className="min-w-0 overflow-hidden">
            <h1 className="text-[9px] xs:text-[10px] sm:text-xs font-black text-[#1e266f] tracking-tight leading-tight truncate">
              CORPORATE TRANSFORMATION <span className="text-[#f36e21]">COCKPIT</span>
            </h1>
            <p className="text-[7px] sm:text-[7.5px] text-slate-400 font-mono tracking-wider uppercase font-semibold truncate hidden sm:block">
              DZ COCKPIT HUB
            </p>
          </div>
        </div>

        {/* User Profile & Role Badge with interactive dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 relative">
          
          {/* Sisi Kanan: TOMBOL PROFILE & ROLE MENU */}
          <div className="relative" ref={profileDropdownRef}>
            {/* Tombol Pemicu Badge User */}
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-slate-50/90 hover:bg-[#f36e21]/5 border border-slate-200 hover:border-[#f36e21]/30 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer h-7 sm:h-9"
              title="Klik untuk lihat detail akun"
            >
              <div className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 rounded-full bg-[#f36e21] text-white flex items-center justify-center text-[10px] sm:text-xs font-black shrink-0">
                {(currentUser?.name || currentUser?.displayName || "U").charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-800 leading-none truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[150px]">
                {currentUser?.name || currentUser?.displayName || "User"}
              </span>
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* DROPDOWN DETAIL AKUN & ROLE */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Header Profil Ringkas */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f36e21] to-amber-500 text-white flex items-center justify-center font-black text-sm shadow-inner">
                    {(currentUser?.name || currentUser?.displayName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                      {currentUser?.name || currentUser?.displayName || "Pengguna"}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                      {currentUser?.email || "email@domain.com"}
                    </p>
                  </div>
                </div>

                {/* Detail Informasi Akun & Role */}
                <div className="py-3 text-xs text-left">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-slate-500 font-medium">Role Hak Akses:</span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-full uppercase text-[9px] sm:text-[10px] ${
                      checkIsAdmin(currentUser) || currentUser?.role === 'ADMIN' 
                        ? 'bg-[#1e266f]/10 text-[#1e266f] border border-[#1e266f]/20' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {currentUser?.role || (checkIsAdmin(currentUser) ? 'ADMIN' : 'VIEWER')}
                    </span>
                  </div>
                </div>

                {/* Tombol Logout */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    handleLogout();
                  }}
                  className="w-full mt-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-650 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* 2. Horizontal Layout Container for Left Sidebar & Content Stage */}
      <div className="flex-1 flex flex-row relative min-h-0">

        {/* Left Vertical Sidebar Navigation */}
        <aside 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`hidden lg:flex flex-col bg-white border-r border-slate-200 sticky top-[61px] h-[calc(100vh-61px)] z-30 transition-all duration-300 ease-in-out shadow-sm shrink-0 ${
            (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "w-16" : "w-64"
          }`}
        >
          {/* Sidebar Header Section */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 min-h-[53px]">
            <span className={`text-[10px] font-mono font-black text-slate-400 tracking-wider transition-all duration-300 uppercase whitespace-nowrap overflow-hidden ${
              (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
            }`}>
              Navigasi Utama
            </span>
            
            {/* Collapse / Pin Toggle Button */}
            {!isAutoHideEnabled && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-[#1e266f] transition-all cursor-pointer shrink-0"
                title={isSidebarCollapsed ? "Perluas Menu" : "Sembunyikan Menu"}
              >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Navigation Tab Links list */}
          <nav className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
            
            {/* Tab: Admin Panel (Only for admin user) */}
            {checkIsAdmin(currentUser) && (
              <button
                id="menu-admin-panel"
                onClick={() => setActiveTab("admin_panel")}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-black tracking-tight font-sans transition-all duration-200 rounded-xl cursor-pointer w-full text-left shrink-0 ${
                  activeTab === "admin_panel"
                    ? "bg-red-600 text-white shadow-sm font-extrabold border-l-4 border-amber-300"
                    : "text-slate-650 hover:text-red-600 hover:bg-slate-100"
                }`}
                title="Admin Panel"
              >
                <Shield className={`w-4 h-4 shrink-0 ${activeTab === "admin_panel" ? "text-amber-300" : ""}`} />
                <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
                }`}>
                  Admin Panel
                </span>
              </button>
            )}

            {/* Tab 1: Dashboard */}
            <button
              id="menu-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-black tracking-tight font-sans transition-all duration-200 rounded-xl cursor-pointer w-full text-left shrink-0 ${
                activeTab === "dashboard"
                  ? "bg-[#1e266f] text-white shadow-sm font-extrabold border-l-4 border-[#f36e21]"
                  : "text-slate-650 hover:text-[#1e266f] hover:bg-slate-100"
              }`}
              title="Dashboard Cockpit"
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === "dashboard" ? "text-[#f36e21]" : ""}`} />
              <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
              }`}>
                Dashboard Cockpit
              </span>
            </button>

            {/* Tab 2: Tracker */}
            <button
              id="menu-tracker"
              onClick={() => setActiveTab("tracker")}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-black tracking-tight font-sans transition-all duration-200 rounded-xl cursor-pointer w-full text-left shrink-0 ${
                activeTab === "tracker"
                  ? "bg-[#1e266f] text-white shadow-sm font-extrabold border-l-4 border-[#f36e21]"
                  : "text-slate-650 hover:text-[#1e266f] hover:bg-slate-100"
              }`}
              title="Program Tracker"
            >
              <ListTodo className={`w-4 h-4 shrink-0 ${activeTab === "tracker" ? "text-[#f36e21]" : ""}`} />
              <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
              }`}>
                Program Tracker
              </span>
            </button>

            {/* Tab 3: Logs */}
            <button
              id="menu-logs"
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-black tracking-tight font-sans transition-all duration-200 rounded-xl cursor-pointer w-full text-left shrink-0 ${
                activeTab === "logs"
                  ? "bg-[#1e266f] text-white shadow-sm font-extrabold border-l-4 border-[#f36e21]"
                  : "text-slate-650 hover:text-[#1e266f] hover:bg-slate-100"
              }`}
              title="Meeting Logs"
            >
              <History className={`w-4 h-4 shrink-0 ${activeTab === "logs" ? "text-[#f36e21]" : ""}`} />
              <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
              }`}>
                Meeting Logs
              </span>
            </button>

            {/* Tab 4: Cloud Docs */}
            <button
              id="menu-documents"
              onClick={() => setActiveTab("cloud_docs")}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-black tracking-tight font-sans transition-all duration-200 rounded-xl cursor-pointer w-full text-left shrink-0 ${
                activeTab === "cloud_docs"
                  ? "bg-[#1e266f] text-white shadow-sm font-extrabold border-l-4 border-[#f36e21]"
                  : "text-slate-650 hover:text-[#1e266f] hover:bg-slate-100"
              }`}
              title="Arsip Dokumen"
            >
              <CloudLightning className={`w-4 h-4 shrink-0 ${activeTab === "cloud_docs" ? "text-[#f36e21]" : ""}`} />
              <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 w-0" : "opacity-100 w-auto"
              }`}>
                Arsip Dokumen
              </span>
            </button>

          </nav>

          {/* Sidebar Footer Section */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2 shrink-0">
            <div className={`text-[8px] font-mono text-slate-400 leading-tight select-none transition-opacity duration-300 px-2 ${
              (isAutoHideEnabled ? !isHovered : isSidebarCollapsed) ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
            }`}>
              <span>ZT Cockpit • V1.0</span>
            </div>
          </div>
        </aside>

        {/* 3. Main Stage Content Frame */}
        <main className="flex-1 max-w-none w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 overflow-x-hidden min-h-0">
          
          {/* Loading overlay for transitions */}
          {isLoading && (
            <div className="flex items-center justify-center p-12 bg-white/50 backdrop-blur-[1px] absolute inset-x-0 top-32 bottom-0 z-40 transition-all font-mono text-xs text-slate-500 gap-3">
              <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
              Sinkronisasi data cloud...
            </div>
          )}

        {/* Dynamic Navigation rendering views */}
        <div className="transition-opacity duration-200">
          
          {dataError && (
            <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-start gap-3 shadow-xs">
              <div className="text-amber-600 font-bold shrink-0 mt-0.5">⚠️</div>
              <div className="flex-1 text-xs text-amber-800">
                <span className="font-bold">Peringatan Sinkronisasi:</span> {dataError}
                <div className="mt-1 text-[10px] text-amber-600">
                  Aplikasi tetap berjalan normal menggunakan salinan data lokal/cache. Fungsi-fungsi utama Anda tidak akan terganggu.
                </div>
              </div>
              <button 
                onClick={() => setDataError(null)} 
                className="text-amber-500 hover:text-amber-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          )}
          
          {activeTab === "admin_panel" && checkIsAdmin(currentUser) && (
            <AdminDashboardView 
              usersList={usersList}
              programs={programs}
              logs={logs}
              documents={documents}
              onRefreshData={loadData}
              currentUser={currentUser}
            />
          )}

          {activeTab === "dashboard" && (
            <DashboardView 
              programs={programs} 
              logs={logs}
              onAddClick={() => setIsAddModalOpen(true)} 
              onEditProgramClick={handleOpenEditModal}
              onUpdateProgressClick={handleOpenUpdateModal}
              currentUser={currentUser}
            />
          )}

          {activeTab === "tracker" && (
            <ProgramTrackerView 
              programs={programs}
              onAddProgramClick={() => setIsAddModalOpen(true)}
              onUpdateProgressClick={handleOpenUpdateModal}
              onEditProgramClick={handleOpenEditModal}
              onInlineUpdate={handleInlineUpdate}
              onDeleteProgram={handleDeleteProgram}
              currentUser={currentUser}
            />
          )}

          {activeTab === "logs" && (
            <MeetingLogsView 
              logs={logs}
              programs={programs}
              onSubmitLog={handleUpdateProgramAndLog}
              currentUser={currentUser}
              onEditLog={(log) => {
                const matchedProg = programs.find(p => p.id === log.programId) || null;
                setSelectedProgram(matchedProg);
                setLogToEdit(log);
                setIsUpdateModalOpen(true);
              }}
            />
          )}

          {activeTab === "cloud_docs" && (
            <CloudDocumentsView 
              documents={documents}
              onAddDocument={handleAddDocument}
              onDeleteDocument={handleDeleteDocument}
              currentUser={currentUser}
            />
          )}

        </div>

      </main>
    </div>

      {/* 4. Overlay Popups Modals Component Placement */}
      
      {/* Form Tambah Program Baru */}
      <AddProgramModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddProgram}
      />

      {/* Record Minutes of Meeting update popup */}
      <MeetingLogModal 
        isOpen={isUpdateModalOpen}
        program={selectedProgram}
        programs={programs}
        logs={logs}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedProgram(null);
          setLogToEdit(null);
        }}
        onSubmit={handleUpdateProgramAndLog}
        currentUser={currentUser}
        logToEdit={logToEdit}
        onEditSubmit={handleEditMeetingLog}
      />

      {/* Full detail edit modal */}
      <EditProgramModal 
        isOpen={isEditModalOpen}
        program={selectedProgramForEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProgramForEdit(null);
        }}
        onSubmit={handleUpdateProgramFields}
      />

      {/* 5. Minimal Elegant Corporate Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 pb-24 lg:pb-5 text-center text-xs font-mono text-slate-400">
        <div className="max-w-none mx-auto px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ZT Cockpit Control Center © 2026</span>
        </div>
      </footer>

      {/* 6. Floating Action Button (FAB) + Khusus Admin di Kanan Bawah */}
      {(checkIsAdmin(currentUser) || currentUser?.role === "ADMIN") && (
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-20 right-4 sm:right-6 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white active:scale-95 transition-all lg:hidden cursor-pointer"
          title="Tambah Pekerjaan"
        >
          <Plus className="w-7 h-7 stroke-[3]" />
        </button>
      )}

      {/* Sticky Bottom Navigation Bar for Mobile & Tablet View (< lg) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 sm:px-6 py-1.5 sm:py-2 flex justify-around sm:justify-center sm:gap-6 md:gap-10 items-center z-40 lg:hidden shadow-lg">
        {/* Menu Admin - Hanya untuk Admin */}
        {(checkIsAdmin(currentUser) || currentUser?.role === "ADMIN") && (
          <button
            onClick={() => setActiveTab("admin_panel")}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "admin_panel" ? "bg-red-50 text-red-650 font-extrabold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === "admin_panel" ? "text-red-600" : ""}`} />
            <span className="text-[10px] sm:text-xs tracking-tight">Admin</span>
          </button>
        )}

        {/* Menu Cockpit */}
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "dashboard" ? "bg-indigo-50 text-[#1e266f] font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === "dashboard" ? "text-[#f36e21]" : ""}`} />
          <span className="text-[10px] sm:text-xs tracking-tight">Cockpit</span>
        </button>

        {/* Menu Tracker */}
        <button
          onClick={() => setActiveTab("tracker")}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "tracker" ? "bg-indigo-50 text-[#1e266f] font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ListTodo className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === "tracker" ? "text-[#f36e21]" : ""}`} />
          <span className="text-[10px] sm:text-xs tracking-tight">Tracker</span>
        </button>

        {/* Menu Logs */}
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "logs" ? "bg-indigo-50 text-[#1e266f] font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === "logs" ? "text-[#f36e21]" : ""}`} />
          <span className="text-[10px] sm:text-xs tracking-tight">Logs</span>
        </button>

        {/* Menu Dokumen */}
        <button
          onClick={() => setActiveTab("cloud_docs")}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 sm:px-5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "cloud_docs" ? "bg-indigo-50 text-[#1e266f] font-extrabold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CloudLightning className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === "cloud_docs" ? "text-[#f36e21]" : ""}`} />
          <span className="text-[10px] sm:text-xs tracking-tight">Dokumen</span>
        </button>
      </div>

    </div>
  );
}
