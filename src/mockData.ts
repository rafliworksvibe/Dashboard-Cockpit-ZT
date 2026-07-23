import { ProgramJob, MeetingLog } from "./types";

export const initialPrograms: Omit<ProgramJob, "id">[] = [];

export const initialLogs: Omit<MeetingLog, "id">[] = [];
