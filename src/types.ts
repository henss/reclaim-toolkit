export type ReclaimTaskEventCategory = "PERSONAL" | "WORK";

export interface ReclaimConfig {
  apiUrl: string;
  apiKey: string;
  timeoutMs: number;
  defaultTaskEventCategory: ReclaimTaskEventCategory;
  preferredTimePolicyId?: string;
  preferredTimePolicyTitle?: string;
}

export interface ReclaimConfigStatus {
  reachable: false;
  configPath: string;
  notes: string[];
}

export interface ReclaimCurrentUser {
  id: string;
  email: string;
  name?: string;
}

export interface ReclaimTaskRecord {
  id: number;
  title: string;
  notes?: string;
  eventCategory: string;
  timeSchemeId: string;
  due?: string;
  snoozeUntil?: string;
}

export interface ReclaimMeetingRecord {
  id: string;
  title: string;
  start?: string;
  end?: string;
  durationMinutes?: number;
  attendeeCount?: number;
}

export interface ReclaimTimeSchemeWindow {
  dayOfWeek?: string;
  start?: string;
  end?: string;
}

export interface ReclaimTimeSchemeRecord {
  id: string;
  taskCategory: string;
  title: string;
  description?: string;
  timezone?: string;
  features: string[];
  windows?: ReclaimTimeSchemeWindow[];
}

export interface ReclaimTaskAssignmentTimeScheme extends ReclaimTimeSchemeRecord {
}

export interface ReclaimCreateTaskInput {
  title: string;
  notes?: string;
  timeSchemeId: string;
  timeChunksRequired: number;
  minChunkSize: number;
  maxChunkSize: number;
  eventCategory: ReclaimTaskEventCategory;
  due?: string;
  snoozeUntil?: string;
  alwaysPrivate?: boolean;
}

export interface ReclaimUpdateTaskInput {
  title?: string;
  notes?: string;
  timeSchemeId?: string;
  timeChunksRequired?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  eventCategory?: ReclaimTaskEventCategory;
  due?: string;
  snoozeUntil?: string;
  alwaysPrivate?: boolean;
}

export interface ReclaimHealthCheckResult {
  reachable: boolean;
  notes: string[];
  userEmail?: string;
  taskCount?: number;
  taskAssignmentTimeSchemeCount?: number;
}
