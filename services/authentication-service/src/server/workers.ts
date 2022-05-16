import { Environment, IntervalWorker } from "@lindorm-io/koa";
import {
  keyPairCacheWorker,
  keyPairCleanupWorker,
  keyPairDeviceJwksWorker,
  keyPairOAuthJwksWorker,
  keyPairRotationWorker,
  oidcProvidersJwksWorkers,
} from "../worker";
import { configuration } from "./configuration";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.environment !== Environment.TEST) {
  workers.push(keyPairRotationWorker);
  workers.push(keyPairCacheWorker);
  workers.push(keyPairCleanupWorker);

  workers.push(keyPairOAuthJwksWorker);
  workers.push(keyPairDeviceJwksWorker);

  for (const worker of oidcProvidersJwksWorkers) {
    workers.push(worker);
  }
}
