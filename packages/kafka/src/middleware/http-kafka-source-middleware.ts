import { isObject } from "@lindorm/is";
import { IKafkaSource } from "../interfaces";
import { KafkaPylonHttpContext, KafkaPylonHttpMiddleware } from "../types";

export const createHttpKafkaSourceMiddleware = <
  C extends KafkaPylonHttpContext = KafkaPylonHttpContext,
>(
  source: IKafkaSource,
): KafkaPylonHttpMiddleware<C> => {
  return async function httpKafkaSourceMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.sources)) {
      ctx.sources = {} as any;
    }

    ctx.sources.kafka = source.clone({ logger: ctx.logger });

    ctx.logger.debug("Kafka Source added to http context");

    await next();
  };
};
