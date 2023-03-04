import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  browserSessionCleanupWorker,
  clientSessionCleanupWorker,
  keyPairCleanupWorker,
  keyPairMongoCacheWorker,
  keyPairRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(browserSessionCleanupWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairMongoCacheWorker);
  workers.push(keyPairRotationWorker);
  workers.push(clientSessionCleanupWorker);
}
