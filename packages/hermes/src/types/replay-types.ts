export type ReplayOptions = {
  strategy?: "truncate";
};

export type ReplayProgress = {
  phase: "truncating" | "replaying" | "resuming" | "complete";
  processed: number;
  total: number;
  percent: number;
  skipped: number;
};

export interface ReplayHandle {
  on(event: "progress", callback: (progress: ReplayProgress) => void): void;
  on(event: "complete", callback: () => void): void;
  on(event: "error", callback: (error: Error) => void): void;
  cancel(): Promise<void>;
  promise: Promise<void>;
}
