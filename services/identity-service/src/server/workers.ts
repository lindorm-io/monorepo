import { Environment, IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import { keyPairOAuthJwksWorker } from "../worker";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.environment !== Environment.TEST) {
  workers.push(keyPairOAuthJwksWorker);
}
