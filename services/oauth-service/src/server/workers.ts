import { IntervalWorker } from "@lindorm-io/koa";
import { accessSessionCleanupWorker } from "../worker/access-session-cleanup-worker";
import { configuration } from "./configuration";
import {
  browserSessionCleanupWorker,
  keyPairCleanupWorker,
  keyPairMongoCacheWorker,
  keyPairRotationWorker,
  refreshSessionCleanupWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(accessSessionCleanupWorker);
  workers.push(browserSessionCleanupWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairMongoCacheWorker);
  workers.push(keyPairRotationWorker);
  workers.push(refreshSessionCleanupWorker);
}
