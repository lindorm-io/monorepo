import { LindormWorkerEvent } from "../enums";
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

  on(evt: LindormWorkerEvent.Start, listener: LindormWorkerListener): void;
  on(evt: LindormWorkerEvent.Stop, listener: LindormWorkerListener): void;
  on(evt: LindormWorkerEvent.Success, listener: LindormWorkerListener): void;
  on(evt: LindormWorkerEvent.Error, listener: LindormWorkerErrorListener): void;
  on(evt: LindormWorkerEvent.Warning, listener: LindormWorkerErrorListener): void;

  start(): void;
  stop(): void;
  trigger(): Promise<void>;
}
