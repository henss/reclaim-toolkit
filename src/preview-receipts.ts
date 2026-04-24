export type PreviewReceiptReadinessStatus =
  | "ready_for_confirmed_write"
  | "evidence_pending"
  | "read_only_boundary";

export interface PreviewReceipt {
  operation: string;
  previewGeneratedAt: string;
  readinessStatus: PreviewReceiptReadinessStatus;
  readinessGate: string;
  rollbackHint: string;
}

export interface PreviewReceiptOptions {
  operation: string;
  readinessStatus: PreviewReceiptReadinessStatus;
  readinessGate: string;
  rollbackHint?: string;
}

const DEFAULT_ROLLBACK_HINT =
  "No rollback is required because this helper only emits local preview metadata.";

export function createPreviewReceipt(options: PreviewReceiptOptions): PreviewReceipt {
  return {
    operation: options.operation,
    previewGeneratedAt: new Date().toISOString(),
    readinessStatus: options.readinessStatus,
    readinessGate: options.readinessGate,
    rollbackHint: options.rollbackHint ?? DEFAULT_ROLLBACK_HINT
  };
}
