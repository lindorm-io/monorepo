import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import {
  PylonHttpContext,
  PylonOptions,
  PylonSocketContext,
  PylonSource,
  PylonSubscribeOptions,
} from "../../types";
import {
  createQueueSubscription,
  createWehbookDispatchSubscription,
  createWehbookRequestSubscription,
} from "./subscriptions";

export const calculateSubscriptions = <
  H extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
>(
  options: PylonOptions<H, S>,
  sources: Map<string, PylonSource>,
  cache: ConduitClientCredentialsCache,
): Array<PylonSubscribeOptions> => {
  const result: Array<PylonSubscribeOptions> = [];

  if (options.queue?.use === "message") {
    result.push(createQueueSubscription(options.queue));
  }

  if (options.webhook?.use === "message") {
    result.push(
      createWehbookDispatchSubscription(options.webhook, options.logger, cache),
    );
    result.push(createWehbookRequestSubscription(options.webhook, sources));
  }

  return result;
};
