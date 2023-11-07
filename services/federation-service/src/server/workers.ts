import { IntervalWorker } from "@lindorm-io/koa";
import { federationProvidersJwksWorkers } from "../worker";

export const workers: Array<IntervalWorker> = [];

for (const worker of federationProvidersJwksWorkers) {
  workers.push(worker);
}
