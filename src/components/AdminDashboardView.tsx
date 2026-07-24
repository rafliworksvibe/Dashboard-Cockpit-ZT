import { useState, useMemo } from "react";
import { 
  Users, 
  Mail, 
  Calendar, 
  File, 
  Search, 
  ShieldCheck, 
  Download, 
  ExternalLink, 
  User, 
  ChevronRight, 
  Folder, 
  Database,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { ProgramJob, MeetingLog, CloudDocument, AttachmentFile } from "../types";

interface AdminDashboardViewProps {
  usersList: any[];
  programs: ProgramJob[];
  logs: MeetingLog[];
  documents: CloudDocument[];
  onRefreshData?: () => Promise<void>;
  currentUser: any;
}

interface UserFileItem {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  sourceType: "Program" | "Meeting Log" | "Document";
  sourceName: string;
  createdAt: string;
}

export default function AdminDashboardView({
  usersList = [],
  programs = [],
  logs = [],
  documents = [],
  onRefreshData,
  currentUser
}: AdminDashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compile user statistics and files for registered users
  const usersWithStats = useMemo(() => {
    const userMap = new Map<string, any>();

    // Process actual registered users from usersList
    usersList.forEach(u => {
      const uId = u.uid || u.id;
      if (uId && !userMap.has(uId)) {
        userMap.set(uId, {
          ...u,
          uid: uId,
          name: u.displayName || u.name || (u.email ? u.email.split('@')[0] : "Pengguna"),
          email: u.email || "-"
        });
      }
    });

    const registeredUsersList = Array.from(userMap.values());

    return registeredUsersList.map(user => {
      const uId = user.uid || user.id;
      // 1. Get user programs
      const userProgs = programs.filter(p => p.uid === uId);
      // 2. Get user logs
      const userLogs = logs.filter(l => l.uid === uId);
      // 3. Get user documents
      const userDocs = documents.filter(d => d.uid === uId);

      // Extract and compile files
      const userFiles: UserFileItem[] = [];

      userProgs.forEach(p => {
        if (p.files && Array.isArray(p.files)) {
          p.files.forEach(f => {
            userFiles.push({
              name: f.name,
              type: f.type,
              size: f.size,
              dataUrl: f.dataUrl,
              sourceType: "Program",
              sourceName: p.topic,
              createdAt: p.updatedAt || "Tidak diketahui"
            });
          });
        }
      });

      userLogs.forEach(l => {
        if (l.files && Array.isArray(l.files)) {
          l.files.forEach(f => {
            userFiles.push({
              name: f.name,
              type: f.type,
              size: f.size,
              dataUrl: f.dataUrl,
              sourceType: "Meeting Log",
              sourceName: `${l.meetingDate || ""} - ${l.notes.substring(0, 40)}...`,
              createdAt: l.meetingDate || "Tidak diketahui"
            });
          });
        }
      });

      userDocs.forEach(d => {
        if (d.files && Array.isArray(d.files)) {
          d.files.forEach(f => {
            userFiles.push({
              name: f.name,
              type: f.type,
              size: f.size,
              dataUrl: f.dataUrl,
              sourceType: "Document",
              sourceName: d.prihal,
              createdAt: d.createdAt || "Tidak diketahui"
            });
          });
        }
      });

      return {
        ...user,
        programsCount: userProgs.length,
        logsCount: userLogs.length,
        docsCount: userDocs.length,
        files: userFiles,
        filesCount: userFiles.length
      };
    });
  }, [usersList, programs, logs, documents]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return usersWithStats.filter(user => {
      const term = searchQuery.toLowerCase();
      return (
        (user.name || "").toLowerCase().includes(term) ||
        (user.email || "").toLowerCase().includes(term) ||
        (user.roleName || "").toLowerCase().includes(term)
      );
    });
  }, [usersWithStats, searchQuery]);

  // Find the currently selected user data
  const selectedUserData = useMemo(() => {
    if (!selectedUserId) return null;
    return usersWithStats.find(u => (u.uid || u.id) === selectedUserId) || null;
  }, [usersWithStats, selectedUserId]);

  const handleRefresh = async () => {
    if (!onRefreshData) return;
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } catch (e) {
      console.error("Gagal menyegarkan data admin:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateVal?: any): string => {
    if (!dateVal) return "Tidak tersedia";
    try {
      let d: Date;
      // Handle Firestore Timestamp object or objects with seconds
      if (dateVal && typeof dateVal.toDate === "function") {
        d = dateVal.toDate();
      } else if (dateVal && typeof dateVal === "object" && (dateVal.seconds !== undefined || dateVal._seconds !== undefined)) {
        const s = dateVal.seconds !== undefined ? dateVal.seconds : dateVal._seconds;
        d = new Date(s * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else if (typeof dateVal === "string" || typeof dateVal === "number") {
        d = new Date(dateVal);
      } else {
        return "Tidak tersedia";
      }

      if (isNaN(d.getTime())) {
        return typeof dateVal === "string" ? dateVal : "Tidak tersedia";
      }

      return d.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return typeof dateVal === "string" ? dateVal : "Tidak tersedia";
    }
  };

  return (
    <div id="admin-dashboard-container" className="space-y-6">
      
      {/* 1. Admin Status Indicator Bar */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 text-white shadow-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg sm:rounded-xl backdrop-blur-md shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/35 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
                Administrator
              </span>
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight mt-0.5 truncate">
              KAI Admin Dashboard
            </h1>
            <p className="text-white/80 text-[10px] sm:text-xs mt-0.5 line-clamp-1 hidden xs:block">
              Mengelola data rahasia korporat, memonitor profil pengguna, dan mengunduh berkas lampiran.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefreshData && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:bg-white/5 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all border border-white/20 active:scale-95 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Segarkan Data</span>
              <span className="sm:hidden">Segarkan</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Overview Stats Counter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pengguna</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{usersWithStats.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program Kerja</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{programs.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notulen Rapat</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{logs.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <File className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arsip Dokumen</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{documents.length}</div>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Interactive Workspace split-screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Users List Section (span 5 or 12 depending on selection) */}
        <div className={`bg-white rounded-3xl border border-slate-150 p-6 shadow-sm flex flex-col min-h-[480px] ${
          selectedUserId ? "lg:col-span-5" : "lg:col-span-12"
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1e266f]" />
                Daftar Pengguna Aktif
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Filter berdasarkan nama, peran, atau surel pengguna.</p>
            </div>
            
            {/* Search Input Box */}
            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau surel..."
                className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all font-sans"
              />
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <Users className="w-8 h-8 text-slate-300 mb-2" />
                <span className="text-xs font-semibold">Tidak ada pengguna ditemukan</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Coba gunakan kata kunci pencarian lain.</span>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const uKey = user.uid || user.id;
                const isSelected = uKey === selectedUserId;
                const resolvedName = user.displayName || user.name || (user.email && user.email !== "-" ? user.email.split('@')[0] : "Pengguna");
                const initials = resolvedName.charAt(0).toUpperCase();

                return (
                  <div
                    key={uKey}
                    onClick={() => setSelectedUserId(isSelected ? null : uKey)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-slate-900 border-slate-950 text-white shadow-md shadow-slate-900/10"
                        : "bg-slate-50/50 hover:bg-slate-100/70 border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-black text-xs shadow-xs ${
                        isSelected 
                          ? "bg-slate-800 text-white border border-slate-700" 
                          : "bg-[#f36e21] text-white"
                      }`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs tracking-tight truncate max-w-[150px]">
                            {resolvedName}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shrink-0 ${
                            user.role === "ADMIN" 
                              ? "bg-red-100 text-red-700" 
                              : user.role === "TEAM_INTERNAL" 
                                ? "bg-indigo-100 text-indigo-700" 
                                : "bg-slate-100 text-slate-700"
                          }`}>
                            {user.roleName || user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate">
                          <Mail className="w-3 h-3 opacity-60 shrink-0" />
                          <span className="truncate max-w-[180px]">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className={`text-[10px] font-black ${isSelected ? "text-indigo-400" : "text-indigo-600"}`}>
                          {user.filesCount} Berkas
                        </div>
                        <div className="text-[8px] text-slate-400 font-mono mt-0.5">
                          Tergabung {formatDate(user.createdAt).split(",")[0]}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                        isSelected ? "rotate-90 text-white" : "text-slate-400"
                      }`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected User Details & File Explorer (span 7 or closed) */}
        {selectedUserData ? (
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-6 shadow-sm flex flex-col min-h-[480px]">
            {/* Header Profil detail */}
            <div className="border-b border-slate-100 pb-5 mb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-[#f36e21] text-white font-black text-lg rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/15">
                    {(selectedUserData.displayName || selectedUserData.name || (selectedUserData.email && selectedUserData.email !== "-" ? selectedUserData.email.split('@')[0] : "Pengguna")).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      {selectedUserData.displayName || selectedUserData.name || (selectedUserData.email && selectedUserData.email !== "-" ? selectedUserData.email.split('@')[0] : "Pengguna")}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {selectedUserData.roleName || selectedUserData.role}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Daftar: {formatDate(selectedUserData.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedUserId(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Tutup Detail
                </button>
              </div>

              {/* User Email & Core metrics inside card */}
              <div className="grid grid-cols-3 gap-2.5 mt-5">
                <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Program Kerja</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">{selectedUserData.programsCount}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Notulen MoM</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">{selectedUserData.logsCount}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider font-mono">Arsip Dokumen</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">{selectedUserData.docsCount}</span>
                </div>
              </div>
            </div>

            {/* List of files uploaded by user */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-rose-500" />
                  Berkas Uploaded ({selectedUserData.files.length})
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Total Lampiran Cloud</span>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[300px] flex-1 pr-1">
                {selectedUserData.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                    <Folder className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs font-semibold">Tidak ada lampiran berkas</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">Pengguna belum pernah mengupload berkas ke sistem.</span>
                  </div>
                ) : (
                  selectedUserData.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-white hover:bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mt-0.5 shrink-0">
                          <File className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-700 truncate max-w-[280px]" title={file.name}>
                            {file.name}
                          </div>
                          
                          {/* File metadata info */}
                          <div className="flex items-center gap-2 flex-wrap text-[9px] text-slate-400 mt-1 font-sans">
                            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-black shrink-0">
                              {file.type.split("/")[1] || "File"}
                            </span>
                            <span className="shrink-0">{formatSize(file.size)}</span>
                            <span className="text-slate-300 shrink-0">•</span>
                            <span className="text-indigo-600 font-bold shrink-0">
                              Sumber: {file.sourceType}
                            </span>
                          </div>

                          <div className="text-[8px] text-slate-400 mt-0.5 italic truncate max-w-[320px]">
                            {file.sourceName}
                          </div>
                        </div>
                      </div>

                      {/* Download or View action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 sm:self-center">
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-xl transition-all border border-indigo-100 active:scale-95 cursor-pointer shrink-0"
                          referrerPolicy="no-referrer"
                        >
                          <Download className="w-3 h-3" />
                          Unduh
                        </a>
                        <a
                          href={file.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-all border border-slate-200 active:scale-95 cursor-pointer shrink-0"
                          referrerPolicy="no-referrer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex lg:col-span-7 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex-col items-center justify-center p-12 text-center text-slate-400 min-h-[480px]">
            <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
            <span className="text-xs font-bold text-slate-600">Arsip Berkas Pengguna</span>
            <p className="text-[10px] text-slate-400 max-w-xs mt-1">
              Silakan klik salah satu pengguna di sebelah kiri untuk melihat daftar berkas yang telah mereka upload ke platform cloud.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
