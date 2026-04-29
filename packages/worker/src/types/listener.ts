import { LindormWorkerError } from "../errors/index.js";

export type LindormWorkerListener = () => void;

export type LindormWorkerErrorListener = (error: LindormWorkerError) => void;

type DefaultListenerConfig = {
  event: "start" | "stop" | "success";
  listener: LindormWorkerListener;
};

type ErrorListenerConfig = {
  event: "error" | "warning";
  listener: LindormWorkerErrorListener;
};

export type LindormWorkerListenerConfig = DefaultListenerConfig | ErrorListenerConfig;
