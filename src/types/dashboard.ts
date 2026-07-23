export interface ProgramItem {
  id: string;
  topic: string;
  subTopic?: string;
  cluster: string;
  unitOwner: string;
  priority: string;
  phase: string;
  statusTracker: string;
  progress: number;
  ztPic: string;
  startDate?: string;
  deadline?: string;
  createdBy: string;
  createdAt?: any;
}

export interface MeetingLogItem {
  id: string;
  title: string;
  date: string;
  unit: string;
  attendees: string;
  keyNotes: string;
  actionItems: string;
  createdBy: string;
  createdAt?: any;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  fileType: string;
  fileSize: string;
  storagePath?: string;
  downloadURL?: string;
  owner: string;
  createdBy: string;
  createdAt?: any;
}
