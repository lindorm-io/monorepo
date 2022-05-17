import { Environment, IntervalWorker } from "@lindorm-io/koa";
import { keyPairDeviceJwksWorker, keyPairOAuthJwksWorker } from "../worker";
import { configuration } from "./configuration";

export const workers: Array<IntervalWorker> = [];

if (configuration.server.environment !== Environment.TEST) {
  workers.push(keyPairDeviceJwksWorker);
  workers.push(keyPairOAuthJwksWorker);
}
