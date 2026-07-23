export interface AttachmentFile {
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // Base64 data URL or download URL fallback
  downloadURL?: string;
  storagePath?: string;
}

export interface ProgramJob {
  id: string; // Firebase Document ID
  no: number;
  updatedAt?: string; // Last updated timestamp (YYYY-MM-DD HH:mm)
  
  // -- Section 1: Program Tracker --
  topic: string;
  subTopic?: string;
  cluster: "Strategic Transformation" | "Corporate Culture" | "Change Management" | "Investment Governance" | "Corporate Insight";
  owner: string;
  unitOwner?: string; // Alias for owner
  request?: "From DZ" | "Not DZ" | "";
  ztRole: string; // Orchestrator, Challenger, PMO, Integrator, Strategist, Value Designer, Quality Gate Controller, Program Designer, Benchmark, Governance, Reviewer
  strategicImpact: string;
  phase: string; // Ideation, Kajian, Validasi, Approval, Execution, Benefit Realization
  progress: number; // 0-100
  statusTracker: "Green" | "Yellow" | "Red" | "Blocked";
  currentMilestone: string;
  keyIssue: string; // Issue or Decision Needed
  actionPlan: string; // Action Plan or ZT Recommendation
  ztRecommendation?: string; // Alias for actionPlan
  startDate?: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  decisionNeeded: "Yes" | "No";
  dzIntervention: string; // ZT, ZTI, ZTS, ZTE, etc.
  ztPic: string;
  confidence: "High" | "Medium" | "Low" | "No-Go";
  strategicFit: "High" | "Medium" | "Low";
  priority: "Critical" | "High" | "Medium" | "Low"; // Equivalent to Risk Level under Program Tracker
  files?: AttachmentFile[];
  attachmentFiles?: AttachmentFile[]; // Alias for files
  documentLink?: string;
  documentReferenceLink?: string; // Alias for documentLink
  justificationConceptor?: string;
  uid?: string;

  // -- Section 3: Risk Issue --
  riskType?: "Portfolio & Delivery Risk" | "Strategic & Business Model Alignment Risk" | "Change Management & Cultural Readiness Risk" | "Digital & Technology Transformation Risk" | "Controls & Operational Readiness Risk" | "";
  riskIssue?: string;
  riskProgram?: string;
  riskImpact?: number; // 1-5
  riskProbability?: number; // 1-5
  riskLevelScore?: number; // impact * probability
  riskLevel?: "Critical" | "High" | "Medium" | "Low" | "";
  riskMitigation?: string;
  riskOwner?: string;
  riskStatus?: "Open" | "Closed" | "In Progress" | "";
  riskEscalationTo?: string;
  clearThePath?: string;
  notes: string;
}

export interface MeetingLog {
  id: string; // Firebase Document ID
  programId: string;
  programTitle: string;
  meetingDate: string; // YYYY-MM-DD HH:mm
  notes: string; // details of update
  previousStatus: "Green" | "Yellow" | "Red" | "Blocked";
  newStatus: "Green" | "Yellow" | "Red" | "Blocked";
  previousProgress: number;
  newProgress: number;
  recordedBy: string; // user name or default
  files?: AttachmentFile[];
  documentLink?: string;
  uid?: string;
}

export interface CloudDocument {
  id: string; // Firebase Document ID
  tanggalSurat: string; // YYYY-MM-DD
  noSurat: string;
  asalSurat: string;
  prihal: string;
  files?: AttachmentFile[];
  uploadedBy?: string;
  createdAt?: string; // ISO string or format
  storagePath?: string;
  downloadURL?: string;
  uid?: string;
}

export interface UserAccount {
  email: string;
  name: string;
  role: string;
  roleName: string;
  avatarUrl?: string;
  ownerName?: string;
  uid?: string;
}




