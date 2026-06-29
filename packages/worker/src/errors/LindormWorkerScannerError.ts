import { LindormError } from "@lindorm/errors";

export class LindormWorkerScannerError extends LindormError {
  static readonly namespace = "worker";
}
