import { IntervalWorker } from "@lindorm-io/koa";
import { keyPairOauthJwksMemoryWorker, oidcProvidersJwksWorkers } from "../worker";

export const workers: Array<IntervalWorker> = [keyPairOauthJwksMemoryWorker];

for (const worker of oidcProvidersJwksWorkers) {
  workers.push(worker);
}
