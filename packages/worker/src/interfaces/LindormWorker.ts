import { LindormWorkerErrorListener, LindormWorkerListener } from "../types";

export interface ILindormWorker {
  alias: string;
  latestError: Date | null;
  latestStart: Date | null;
  latestStop: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  running: boolean;
  seq: number;
  started: boolean;

  on(evt: "start", listener: LindormWorkerListener): void;
  on(evt: "stop", listener: LindormWorkerListener): void;
  on(evt: "success", listener: LindormWorkerListener): void;
  on(evt: "error", listener: LindormWorkerErrorListener): void;
  on(evt: "warning", listener: LindormWorkerErrorListener): void;

  start(): void;
  stop(): void;
  trigger(): Promise<void>;
}
