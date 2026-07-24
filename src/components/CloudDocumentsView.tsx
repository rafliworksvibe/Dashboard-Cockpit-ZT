import React, { useState, useMemo } from "react";
import { CloudDocument, AttachmentFile, UserAccount } from "../types";
import { checkIsAdmin } from "../utils/rbac";
import { uploadDocumentToStorage } from "../dataService";
import { uploadAndAddDocument } from "../services/dashboardService";
import { 
  FileText, 
  Calendar, 
  Hash, 
  Send, 
  Paperclip, 
  Trash2, 
  Search, 
  Plus, 
  Download, 
  CloudLightning, 
  Tag, 
  X, 
  File, 
  Inbox,
  Eye,
  AlertCircle
} from "lucide-react";

interface CloudDocumentsViewProps {
  documents: CloudDocument[];
  onAddDocument: (docFields: Omit<CloudDocument, "id">) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  currentUser?: UserAccount | null;
}

export default function CloudDocumentsView({
  documents,
  onAddDocument,
  onDeleteDocument,
  currentUser
}: CloudDocumentsViewProps) {
  const isAdmin = checkIsAdmin(currentUser);
  // Navigation & State Management
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Form Fields State
  const [tanggalSurat, setTanggalSurat] = useState("");
  const [noSurat, setNoSurat] = useState("");
  const [asalSurat, setAsalSurat] = useState("");
  const [prihal, setPrihal] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<AttachmentFile | null>(null);
  const [docToDelete, setDocToDelete] = useState<CloudDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // File selection processing without immediate upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processSelectedFiles(e.target.files);
      e.target.value = "";
    }
  };

  const processSelectedFiles = (fileList: FileList) => {
    const validFiles: File[] = [];
    Array.from(fileList).forEach((file) => {
      if (file.size > 5000000) { // 5MB max size
        alert(`File "${file.name}" melebihi batas maksimum 5MB.`);
      } else {
        validFiles.push(file);
      }
    });
    if (validFiles.length > 0) {
      setStagedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  // Form submission handler: strictly uploads to Storage ONCE on submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading) return;
    setModalError(null);

    if (!tanggalSurat) {
      setModalError("Harap isi Tanggal Surat!");
      return;
    }
    if (!noSurat.trim()) {
      setModalError("Harap isi No Surat!");
      return;
    }
    if (!asalSurat.trim()) {
      setModalError("Harap isi Asal Surat!");
      return;
    }
    if (!prihal.trim()) {
      setModalError("Harap isi Perihal!");
      return;
    }

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      let uploadedAttachmentFiles: AttachmentFile[] = [];
      if (stagedFiles.length > 0) {
        const uploadPromises = stagedFiles.map(async (file) => {
          return await uploadDocumentToStorage(file);
        });
        const results = await Promise.all(uploadPromises);
        uploadedAttachmentFiles = results.filter((f): f is AttachmentFile => f !== null);
      }

      const firstAttachment = uploadedAttachmentFiles[0];

      await onAddDocument({
        tanggalSurat,
        noSurat: noSurat.trim(),
        asalSurat: asalSurat.trim(),
        prihal: prihal.trim(),
        files: uploadedAttachmentFiles,
        storagePath: firstAttachment?.storagePath || "",
        downloadURL: firstAttachment?.downloadURL || firstAttachment?.dataUrl || "",
        uploadedBy: currentUser?.name || "Executive Moderator"
      });

      // Clear Form on success
      setTanggalSurat("");
      setNoSurat("");
      setAsalSurat("");
      setPrihal("");
      setStagedFiles([]);
      setIsAddFormOpen(false);
    } catch (error: any) {
      console.error("Gagal menambahkan dokumen:", error);
      setModalError("Gagal mengunggah/menyimpan dokumen: " + (error?.message || "Terjadi kesalahan"));
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    let result = [...documents];

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((doc) => 
        doc.noSurat.toLowerCase().includes(lower) ||
        doc.asalSurat.toLowerCase().includes(lower) ||
        doc.prihal.toLowerCase().includes(lower) ||
        doc.tanggalSurat.toLowerCase().includes(lower)
      );
    }

    if (startDate) {
      result = result.filter((doc) => doc.tanggalSurat >= startDate);
    }

    if (endDate) {
      result = result.filter((doc) => doc.tanggalSurat <= endDate);
    }

    return result;
  }, [documents, searchTerm, startDate, endDate]);

  return (
    <div className="space-y-6">
      
      {/* 1. Page Header & Action Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-lg sm:rounded-xl shrink-0 mt-0.5 sm:mt-0">
            <CloudLightning className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-xs xs:text-sm sm:text-base font-extrabold text-slate-900 font-sans tracking-tight leading-snug sm:leading-tight">
              Arsip Dokumen Surat & Referensi
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-normal max-w-2xl hidden xs:block">
              Pusat penyimpanan digital dokumen surat-menyurat, nota dinas, dan berkas lampiran pendukung.
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
                isAddFormOpen ? "bg-rose-600 hover:bg-rose-700" : "bg-[#f36e21] hover:bg-[#db5610]"
              }`}
            >
              {isAddFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isAddFormOpen ? "Tutup Form" : "Unggah Surat"}
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Add Document Form */}
      {isAdmin && isAddFormOpen && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5 animate-fade-in space-y-4">
          {modalError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-bold text-red-800">{modalError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setModalError(null)} 
                className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Tanggal Surat */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Tanggal Surat <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={tanggalSurat}
                  onChange={(e) => setTanggalSurat(e.target.value)}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded px-8 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-800"
                />
              </div>
            </div>

            {/* No Surat */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                No Surat <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={noSurat}
                  onChange={(e) => setNoSurat(e.target.value)}
                  placeholder="05/SURAT/VII/2026"
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded pl-8 pr-3 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-800 placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Asal Surat */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Asal Surat <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={asalSurat}
                onChange={(e) => setAsalSurat(e.target.value)}
                placeholder="Direktorat Strategis"
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded px-3 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-800 placeholder:text-slate-300"
              />
            </div>

            {/* Perihal */}
            <div className="md:col-span-12 space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Perihal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={prihal}
                onChange={(e) => setPrihal(e.target.value)}
                placeholder="Deskripsi singkat surat..."
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded px-3 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-800 placeholder:text-slate-300"
              />
            </div>

            {/* File Attachments drag & drop */}
            <div className="md:col-span-12 space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Lampiran Berkas
              </label>
              <div 
                className={`border border-dashed rounded bg-white p-4 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? "border-indigo-400 bg-indigo-50/50" 
                    : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    processSelectedFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => document.getElementById("cloud-doc-file-input")?.click()}
              >
                <input
                  id="cloud-doc-file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center space-y-1">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center space-y-1 py-2">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[11px] font-medium text-slate-600">Mengunggah file ke Firebase Storage...</p>
                    </div>
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      <p className="text-[11px] font-medium text-slate-600">
                        Geser file di sini, atau <span className="text-indigo-600 font-semibold hover:underline">pilih berkas</span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* List of staged files to be uploaded */}
            {stagedFiles.length > 0 && (
              <div className="md:col-span-12 border border-slate-200 rounded divide-y divide-slate-100 bg-white">
                {stagedFiles.map((file, index) => (
                  <div key={index} className="px-3 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="font-medium text-slate-700 truncate max-w-[200px] sm:max-w-[400px]" title={file.name}>
                          {file.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        disabled={isSubmitting || isUploading}
                        onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50"
                        title="Hapus"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting || isUploading}
              onClick={() => {
                setTanggalSurat("");
                setNoSurat("");
                setAsalSurat("");
                setPrihal("");
                setStagedFiles([]);
                setIsAddFormOpen(false);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {(isSubmitting || isUploading) ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Mengunggah & Menyimpan...</span>
                </>
              ) : (
                "Simpan Arsip"
              )}
            </button>
          </div>
        </form>
      )}

      {/* 3. Search and filter panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Keyword Search Input */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan No Surat, Asal Surat, Perihal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-semibold bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg pl-9 pr-9 py-2 sm:py-2.5 outline-none transition-all text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters and Counters Container */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Date Range Picker Group */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tgl:</span>
            </div>
            
            <div className="flex items-center gap-1 flex-1 sm:flex-initial">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-28 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 outline-none px-1.5 py-1 text-center cursor-pointer focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-2xs"
                title="Tanggal Mulai"
              />
              <span className="text-slate-400 text-xs shrink-0">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-28 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 outline-none px-1.5 py-1 text-center cursor-pointer focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-2xs"
                title="Tanggal Selesai"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                title="Reset Tanggal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Total Archive Badge Counter */}
          <div className="flex items-center justify-center px-3 py-2 bg-indigo-50/80 border border-indigo-100 rounded-lg text-[10px] font-mono font-bold text-slate-600 shrink-0 whitespace-nowrap shadow-2xs">
            {filteredDocs.length !== documents.length ? (
              <span className="text-indigo-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                DITEMUKAN: <strong className="text-indigo-900 font-extrabold">{filteredDocs.length}</strong> / {documents.length}
              </span>
            ) : (
              <span className="text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                TOTAL ARSIP: <strong className="text-indigo-950 font-extrabold">{documents.length}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Documents List Area (Minimalist) */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="p-4 bg-slate-50 text-slate-300 rounded-full">
            <Inbox className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-700">Tidak Ada Dokumen Surat</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchTerm 
                ? "Tidak menemukan hasil pencarian untuk kata kunci tersebut. Coba cari kata kunci lainnya."
                : "Belum ada dokumen yang diunggah ke cloud. Klik tombol 'Unggah Surat Baru' untuk mulai mengarsipkan."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table view for Medium and Larger screens */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-5 py-3 whitespace-nowrap">No Surat</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tanggal</th>
                    <th className="px-5 py-3 min-w-[250px]">Asal / Perihal</th>
                    <th className="px-5 py-3 whitespace-nowrap">Lampiran</th>
                    <th className="px-5 py-3 whitespace-nowrap text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocs.map((docItem) => (
                    <tr key={docItem.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap font-mono font-medium text-slate-700">
                        {docItem.noSurat}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {docItem.tanggalSurat}
                          </span>
                          <span className="text-[10px] text-slate-400">Diunggah: {docItem.createdAt || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider w-fit flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {docItem.asalSurat}
                          </span>
                          <span className="font-semibold text-slate-800 leading-snug">
                            {docItem.prihal}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {docItem.files && docItem.files.length > 0 ? (
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            {docItem.files.map((file, fIdx) => (
                              <div key={fIdx} className="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-1.5 rounded text-[11px] hover:border-slate-300 transition-colors">
                                <span className="truncate max-w-[100px] font-medium text-slate-600" title={file.name}>
                                  {file.name}
                                </span>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <button
                                    onClick={() => setSelectedPreviewFile(file)}
                                    className="text-indigo-650 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded cursor-pointer flex items-center justify-center"
                                    title="Pratinjau"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <a 
                                    href={file.downloadURL || file.dataUrl} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={file.name}
                                    className="text-orange-600 hover:text-orange-700 font-bold flex items-center justify-center p-1 hover:bg-orange-50 rounded shrink-0"
                                    title="Download"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right align-middle">
                        {isAdmin && (
                          <button
                            onClick={() => setDocToDelete(docItem)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards view for Mobile/Tablet screens */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredDocs.map((docItem) => (
              <div key={docItem.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {docItem.noSurat}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {docItem.tanggalSurat}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setDocToDelete(docItem)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                      title="Hapus Dokumen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider w-fit flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    {docItem.asalSurat}
                  </span>
                  <p className="font-semibold text-slate-800 text-xs leading-normal">
                    {docItem.prihal}
                  </p>
                </div>

                {docItem.files && docItem.files.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lampiran:</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {docItem.files.map((file, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded text-[11px] hover:border-slate-300 transition-colors">
                          <span className="truncate max-w-[150px] font-medium text-slate-600 font-mono" title={file.name}>
                            {file.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <button
                              onClick={() => setSelectedPreviewFile(file)}
                              className="text-indigo-650 hover:text-indigo-800 p-1 bg-white border border-slate-200 rounded shadow-3xs cursor-pointer flex items-center justify-center shrink-0"
                              title="Pratinjau"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a 
                              href={file.downloadURL || file.dataUrl} 
                              target="_blank"
                              rel="noopener noreferrer"
                              download={file.name}
                              className="text-orange-600 hover:text-orange-700 font-bold flex items-center justify-center p-1 bg-white border border-slate-200 rounded shadow-3xs shrink-0"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {selectedPreviewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col border border-slate-200 animate-scale-in">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-800 truncate" title={selectedPreviewFile.name}>
                  {selectedPreviewFile.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-slate-50/50 min-h-[300px] max-h-[70vh]">
              {selectedPreviewFile.type.startsWith("image/") ? (
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  <img
                    src={selectedPreviewFile.downloadURL || selectedPreviewFile.dataUrl}
                    alt={selectedPreviewFile.name}
                    className="max-w-full max-h-[55vh] object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : selectedPreviewFile.type.startsWith("text/") || 
                  selectedPreviewFile.name.endsWith(".txt") || 
                  selectedPreviewFile.name.endsWith(".json") || 
                  selectedPreviewFile.name.endsWith(".xml") || 
                  selectedPreviewFile.name.endsWith(".csv") ? (
                <pre className="w-full text-left bg-slate-950 text-slate-200 p-4 rounded-lg text-xs overflow-auto max-h-[55vh] font-mono border border-slate-800 leading-relaxed shadow-inner">
                  {(() => {
                    try {
                      const base64 = (selectedPreviewFile.downloadURL || selectedPreviewFile.dataUrl).split(",")[1];
                      return atob(base64);
                    } catch (e) {
                      return "Format file tidak dapat didekode sebagai teks.";
                    }
                  })()}
                </pre>
              ) : (
                <div className="text-center p-8 bg-white border border-slate-200 rounded-xl shadow-3xs max-w-md w-full flex flex-col items-center gap-4">
                  <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                    <File className="w-12 h-12" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">Pratinjau Tidak Tersedia</h4>
                    <p className="text-xs text-slate-500">
                      Pratinjau langsung untuk file bertipe <span className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{selectedPreviewFile.type || "unknown"}</span> tidak didukung.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500">
                Ukuran: {(selectedPreviewFile.size / 1024).toFixed(1)} KB
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewFile(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <a
                  href={selectedPreviewFile.downloadURL || selectedPreviewFile.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={selectedPreviewFile.name}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh File
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-slate-200 animate-scale-in">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-150 bg-rose-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Konfirmasi Hapus Dokumen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus arsip dokumen berikut?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">No Surat:</span>
                  <span className="font-mono font-bold text-slate-800">{docToDelete.noSurat}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Asal Surat:</span>
                  <span className="font-semibold text-slate-700">{docToDelete.asalSurat}</span>
                </div>
                <div className="flex items-start justify-between text-xs gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-medium shrink-0">Perihal:</span>
                  <span className="font-medium text-slate-800 text-right line-clamp-2">{docToDelete.prihal}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2.5 rounded border border-rose-100">
                ⚠️ Catatan: File fisik yang tersimpan di Firebase Storage akan dihapus secara permanen beserta data Firestore-nya.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={async () => {
                  setIsDeletingDoc(true);
                  try {
                    await onDeleteDocument(docToDelete.id);
                  } catch (err) {
                    console.error("Gagal menghapus dokumen:", err);
                  } finally {
                    setIsDeletingDoc(false);
                    setDocToDelete(null);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingDoc ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Dokumen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
