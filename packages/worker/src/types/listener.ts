import { LindormError } from "@lindorm/errors";
import { LindormWorkerEvent } from "../enums";

export type LindormWorkerListener = () => void;

export type LindormWorkerErrorListener = (error: LindormError) => void;

type DefaultListenerConfig = {
  event: LindormWorkerEvent.Start | LindormWorkerEvent.Stop | LindormWorkerEvent.Success;
  listener: LindormWorkerListener;
};

type ErrorListenerConfig = {
  event: LindormWorkerEvent.Error | LindormWorkerEvent.Warning;
  listener: LindormWorkerErrorListener;
};

export type LindormWorkerListenerConfig = DefaultListenerConfig | ErrorListenerConfig;
