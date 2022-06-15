import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import { keyPairOauthJwksWorker, oidcProvidersJwksWorkers } from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairOauthJwksWorker);

  for (const worker of oidcProvidersJwksWorkers) {
    workers.push(worker);
  }
}
