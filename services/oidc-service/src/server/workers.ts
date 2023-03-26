import { IntervalWorker } from "@lindorm-io/koa";
import { oidcProvidersJwksWorkers } from "../worker";

export const workers: Array<IntervalWorker> = [];

for (const worker of oidcProvidersJwksWorkers) {
  workers.push(worker);
}
