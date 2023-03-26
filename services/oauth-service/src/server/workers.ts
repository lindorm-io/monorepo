import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import { browserSessionCleanupWorker, clientSessionCleanupWorker } from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(browserSessionCleanupWorker);
  workers.push(clientSessionCleanupWorker);
}
