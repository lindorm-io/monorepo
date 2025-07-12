import { isObject } from "@lindorm/is";
import { IKafkaSource } from "../interfaces";
import { KafkaPylonSocketContext, KafkaPylonSocketMiddleware } from "../types";

export const createSocketKafkaSourceMiddleware = <
  C extends KafkaPylonSocketContext = KafkaPylonSocketContext,
>(
  source: IKafkaSource,
): KafkaPylonSocketMiddleware<C> => {
  return async function socketKafkaSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.kafka = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Kafka Source added to event context");

    await next();
  };
};
