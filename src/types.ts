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

export interface ReclaimTaskAssignmentTimeScheme {
  id: string;
  taskCategory: string;
  title: string;
  description?: string;
  features: string[];
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
