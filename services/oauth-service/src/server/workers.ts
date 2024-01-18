import { IntervalWorker } from "@lindorm-io/koa";
import { browserSessionCleanupWorker, clientSessionCleanupWorker } from "../worker";

export const workers: Array<IntervalWorker> = [
  browserSessionCleanupWorker,
  clientSessionCleanupWorker,
];
