import { LindormError } from "@lindorm/errors";

export class LindormWorkerError extends LindormError {
  public static readonly namespace = "worker";
}
