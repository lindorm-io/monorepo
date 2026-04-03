import {
  LindormWorkerErrorListener,
  LindormWorkerHealth,
  LindormWorkerListener,
} from "../types";

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

  off(evt: "start", listener: LindormWorkerListener): void;
  off(evt: "stop", listener: LindormWorkerListener): void;
  off(evt: "success", listener: LindormWorkerListener): void;
  off(evt: "error", listener: LindormWorkerErrorListener): void;
  off(evt: "warning", listener: LindormWorkerErrorListener): void;

  once(evt: "start", listener: LindormWorkerListener): void;
  once(evt: "stop", listener: LindormWorkerListener): void;
  once(evt: "success", listener: LindormWorkerListener): void;
  once(evt: "error", listener: LindormWorkerErrorListener): void;
  once(evt: "warning", listener: LindormWorkerErrorListener): void;

  destroy(): Promise<void>;
  health(): LindormWorkerHealth;
  start(): void;
  stop(): Promise<void>;
  trigger(): Promise<void>;
}
