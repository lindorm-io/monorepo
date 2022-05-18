import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  keyPairCacheWorker,
  keyPairCleanupWorker,
  keyPairOAuthJwksWorker,
  keyPairRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairRotationWorker);
  workers.push(keyPairCacheWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairOAuthJwksWorker);
}
