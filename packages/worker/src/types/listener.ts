import { LindormError } from "@lindorm/errors";

export type LindormWorkerListener = () => void;

export type LindormWorkerErrorListener = (error: LindormError) => void;

type DefaultListenerConfig = {
  event: "start" | "stop" | "success";
  listener: LindormWorkerListener;
};

type ErrorListenerConfig = {
  event: "error" | "warning";
  listener: LindormWorkerErrorListener;
};

export type LindormWorkerListenerConfig = DefaultListenerConfig | ErrorListenerConfig;
