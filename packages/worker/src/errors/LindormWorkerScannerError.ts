import { LindormError } from "@lindorm/errors";

export class LindormWorkerScannerError extends LindormError {
  public static readonly namespace = "worker";
}
