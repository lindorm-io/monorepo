import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { KafkaEachMessagePayload, KafkaSharedState } from "../types/kafka-types.js";
import { DriverRpcServerBase } from "../../../classes/DriverRpcServerBase.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import { parseKafkaMessage } from "../utils/parse-kafka-message.js";
import { resolveGroupId } from "../utils/resolve-group-id.js";
import { getOrCreatePooledConsumer } from "../utils/create-kafka-consumer.js";
import { releasePooledConsumer } from "../utils/stop-kafka-consumer.js";

export type KafkaRpcServerOptions<Req extends IMessage, Res extends IMessage> = {
  state: KafkaSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

type OwnedRpcConsumer = {
  consumerTag: string;
  kafkaTopic: string;
  groupId: string;
};

export class KafkaRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  private readonly state: KafkaSharedState;
  private readonly ownedConsumers: Map<string, OwnedRpcConsumer> = new Map();

  public constructor(options: KafkaRpcServerOptions<Req, Res>) {
    super(options, "KafkaRpcServer");
    this.state = options.state;
  }

  protected async doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    if (!this.state.kafka || !this.state.producer) {
      throw new IrisDriverError("Cannot serve RPC: Kafka client is not connected");
    }

    const kafkaTopic = resolveTopicName(this.state.prefix, `rpc.${topic}`);
    const groupId = resolveGroupId({
      prefix: this.state.prefix,
      topic,
      queue,
      type: "rpc",
      generation: this.state.resetGeneration,
    });

    const onMessage = async (payload: KafkaEachMessagePayload): Promise<void> => {
      const envelope = parseKafkaMessage(payload);

      try {
        const { responseEnvelope } = await this.processRequest(
          handler,
          envelope.payload,
          envelope.headers,
          queue,
        );
        responseEnvelope.correlationId = envelope.correlationId;

        if (envelope.replyTo && this.state.producer) {
          const kafkaMessage = serializeKafkaMessage(responseEnvelope);
          await this.state.producer.send({
            topic: envelope.replyTo,
            messages: [kafkaMessage],
            acks: this.state.acks,
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("RPC handler error", { error: err.message, queue });

        if (envelope.replyTo && this.state.producer) {
          const errorEnvelope = this.buildErrorEnvelope(
            queue,
            err,
            envelope.correlationId,
          );
          const kafkaMessage = serializeKafkaMessage(errorEnvelope);
          await this.state.producer.send({
            topic: envelope.replyTo,
            messages: [kafkaMessage],
            acks: this.state.acks,
          });
        }
      }
    };

    const { consumerTag } = await getOrCreatePooledConsumer({
      state: this.state,
      groupId,
      topic: kafkaTopic,
      onMessage,
      logger: this.logger,
    });

    this.state.consumerRegistrations.push({
      consumerTag,
      groupId,
      topic: kafkaTopic,
      onMessage,
    });

    this.ownedConsumers.set(queue, {
      consumerTag,
      kafkaTopic,
      groupId,
    });
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const queue = options?.queue ?? this.getDefaultQueue();
    const owned = this.ownedConsumers.get(queue);

    if (owned) {
      await releasePooledConsumer({
        state: this.state,
        groupId: owned.groupId,
        topic: owned.kafkaTopic,
        logger: this.logger,
      });

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === owned.consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      this.ownedConsumers.delete(queue);
    }
    this.registeredQueues.delete(queue);

    this.logger.debug("RPC handler unregistered", { queue });
  }

  public async unserveAll(): Promise<void> {
    for (const [queue, owned] of this.ownedConsumers) {
      await releasePooledConsumer({
        state: this.state,
        groupId: owned.groupId,
        topic: owned.kafkaTopic,
        logger: this.logger,
      });

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === owned.consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      this.ownedConsumers.delete(queue);
    }

    this.registeredQueues.clear();

    this.logger.debug("All RPC handlers unregistered");
  }
}
