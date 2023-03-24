import { IntervalWorker } from "@lindorm-io/koa";
import { keyPairOauthJwksMemoryWorker } from "../worker";

export const workers: Array<IntervalWorker> = [keyPairOauthJwksMemoryWorker];
