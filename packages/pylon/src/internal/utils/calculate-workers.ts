import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { LindormWorkerConfig } from "@lindorm/worker";
import {
  PylonHttpContext,
  PylonOptions,
  PylonSocketContext,
  PylonSource,
} from "../../types";
import {
  createQueueWorker,
  createWebhookDispatchWorker,
  createWebhookRequestWorker,
} from "./workers";

export const calculateWorkers = <
  H extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
>(
  options: PylonOptions<H, S>,
  sources: Map<string, PylonSource>,
  cache: ConduitClientCredentialsCache,
): Array<LindormWorkerConfig> => {
  const result: Array<LindormWorkerConfig> = [];

  if (options.queue?.use === "entity") {
    result.push(createQueueWorker(options.queue, sources));
  }

  if (options.webhook?.use === "entity") {
    result.push(
      createWebhookDispatchWorker(options.webhook, sources, options.logger, cache),
    );
    result.push(createWebhookRequestWorker(options.webhook, sources));
  }

  return result;
};
