import { LindormWorkerEvent } from "../enums";

export interface ILindormWorker {
  executing: boolean;
  latestError: Date | null;
  latestSuccess: Date | null;
  latestTry: Date | null;
  running: boolean;
  seq: number;

  on(evt: LindormWorkerEvent.Start, listener: () => void): void;
  on(evt: LindormWorkerEvent.Stop, listener: () => void): void;
  on(
    evt: LindormWorkerEvent.Success,
    listener: (result: string | undefined) => void,
  ): void;
  on(evt: LindormWorkerEvent.Error, listener: (error: Error) => void): void;

  start(): void;
  stop(): void;
}
