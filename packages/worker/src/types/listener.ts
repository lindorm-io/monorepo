import { LindormError } from "@lindorm/errors";
import { LindormWorkerEvent } from "../enums";

export type LindormWorkerListener = () => void;

export type LindormWorkerSuccessListener<T = unknown> = (result: T) => void;

export type LindormWorkerErrorListener = (error: LindormError) => void;

type DefaultListenerConfig = {
  event: LindormWorkerEvent.Start | LindormWorkerEvent.Stop;
  listener: LindormWorkerListener;
};

type SuccessListenerConfig<T = unknown> = {
  event: LindormWorkerEvent.Success;
  listener: LindormWorkerSuccessListener<T>;
};

type ErrorListenerConfig = {
  event: LindormWorkerEvent.Error | LindormWorkerEvent.Warning;
  listener: LindormWorkerErrorListener;
};

export type LindormWorkerListenerConfig<T = unknown> =
  | DefaultListenerConfig
  | SuccessListenerConfig<T>
  | ErrorListenerConfig;
