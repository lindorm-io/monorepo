import { LindormError } from "@lindorm/errors";

export class LindormWorkerError extends LindormError {
  static readonly namespace = "worker";
}
