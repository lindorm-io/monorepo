import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  browserSessionCleanupWorker,
  clientSessionCleanupWorker,
  keyPairCleanupWorker,
  keyPairMongoMemoryWorker,
  keyPairRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [keyPairMongoMemoryWorker];

if (configuration.server.workers) {
  workers.push(browserSessionCleanupWorker);
  workers.push(clientSessionCleanupWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairRotationWorker);
}
