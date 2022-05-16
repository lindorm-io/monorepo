import { Environment, IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  browserSessionCleanupWorker,
  clientCacheWorker,
  keyPairCacheWorker,
  keyPairCleanupWorker,
  keyPairRotationWorker,
  refreshSessionCleanupWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.environment !== Environment.TEST) {
  workers.push(keyPairRotationWorker);
  workers.push(keyPairCacheWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(clientCacheWorker);
  workers.push(browserSessionCleanupWorker);
  workers.push(refreshSessionCleanupWorker);
}
