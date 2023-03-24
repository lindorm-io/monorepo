import { IntervalWorker } from "@lindorm-io/koa";
import { keyPairDeviceJwksMemoryWorker, keyPairOauthJwksMemoryWorker } from "../worker";
import { configuration } from "./configuration";

export const workers: Array<IntervalWorker> = [
  keyPairDeviceJwksMemoryWorker,
  keyPairOauthJwksMemoryWorker,
];

if (configuration.server.workers) {
  /* skeleton */
}
