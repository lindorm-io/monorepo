import { IKafkaSource } from "@lindorm/kafka";
import { ILogger } from "@lindorm/logger";
import { IRabbitSource } from "@lindorm/rabbit";
import { IRedisSource } from "@lindorm/redis";
import { Constructor } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus } from "../../interfaces";

export type MessageBusOptions<M extends IHermesMessage = IHermesMessage> = {
  custom?: IHermesMessageBus<M>;
  kafka?: IKafkaSource;
  rabbit?: IRabbitSource;
  redis?: IRedisSource;
};

export type HermesMessageBusOptions<M extends IHermesMessage = IHermesMessage> =
  MessageBusOptions<M> & {
    Message: Constructor<M>;
    logger: ILogger;
  };
