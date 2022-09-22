import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  browserSessionCleanupWorker,
  clientCacheWorker,
  // keyPairAuthenticationJwksWorker,
  keyPairCleanupWorker,
  keyPairMongoCacheWorker,
  keyPairRotationWorker,
  refreshSessionCleanupWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(browserSessionCleanupWorker);
  workers.push(clientCacheWorker);
  // workers.push(keyPairAuthenticationJwksWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairMongoCacheWorker);
  workers.push(keyPairRotationWorker);
  workers.push(refreshSessionCleanupWorker);
}
