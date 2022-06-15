import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import { keyPairOauthJwksWorker } from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.workers) {
  workers.push(keyPairOauthJwksWorker);
}
