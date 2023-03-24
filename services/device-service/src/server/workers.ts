import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import {
  keyPairCleanupWorker,
  keyPairMongoMemoryWorker,
  keyPairOauthJwksMemoryWorker,
  keyPairRotationWorker,
} from "../worker";

export const workers: Array<IntervalWorker> = [
  keyPairMongoMemoryWorker,
  keyPairOauthJwksMemoryWorker,
];

if (configuration.server.workers) {
  workers.push(keyPairCleanupWorker);
  workers.push(keyPairRotationWorker);
}
