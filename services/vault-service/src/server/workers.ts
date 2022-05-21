import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  keyPairCacheWorker,
  keyPairCleanupWorker,
  keyPairEcRotationWorker,
  keyPairOAuthJwksWorker,
  keyPairRsaRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairCacheWorker);
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairOAuthJwksWorker);
  workers.push(keyPairEcRotationWorker);
  workers.push(keyPairRsaRotationWorker);
}
