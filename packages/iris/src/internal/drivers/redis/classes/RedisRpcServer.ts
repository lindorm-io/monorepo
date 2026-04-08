import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import type { IMessage } from "../../../../interfaces";
import type { IAmphora } from "@lindorm/amphora";
import type { RedisSharedState, RedisStreamEntry } from "../types/redis-types";
import { DriverRpcServerBase } from "../../../classes/DriverRpcServerBase";
import { resolveStreamKey } from "../utils/resolve-stream-key";
import { resolveGroupName } from "../utils/resolve-group-name";
import { serializeStreamFields } from "../utils/serialize-stream-fields";
import { xaddToStream } from "../utils/xadd-to-stream";
import { createConsumerLoop } from "../utils/create-consumer-loop";
import { stopConsumerLoop } from "../utils/stop-consumer-loop";

export type RedisRpcServerOptions<Req extends IMessage, Res extends IMessage> = {
  state: RedisSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

export class RedisRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  private readonly state: RedisSharedState;
  private readonly ownedConsumerTags: Map<string, string> = new Map();

  public constructor(options: RedisRpcServerOptions<Req, Res>) {
    super(options, "RedisRpcServer");
    this.state = options.state;
  }

  protected async doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot serve RPC: connection is not available");
    }

    const streamKey = resolveStreamKey(this.state.prefix, `rpc:${topic}`);
    const groupName = resolveGroupName({
      prefix: this.state.prefix,
      topic,
      queue,
      type: "rpc",
    });

    const onEntry = async (entry: RedisStreamEntry): Promise<void> => {
      try {
        const { responseEnvelope } = await this.processRequest(
          handler,
          entry.payload,
          entry.headers,
          queue,
        );
        responseEnvelope.correlationId = entry.correlationId;

        if (entry.replyTo && this.state.publishConnection) {
          const fields = serializeStreamFields(responseEnvelope);
          await xaddToStream(this.state.publishConnection, entry.replyTo, fields);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("RPC handler error", { error: err.message, queue });

        if (entry.replyTo && this.state.publishConnection) {
          const errorEnvelope = this.buildErrorEnvelope(queue, err, entry.correlationId);
          const fields = serializeStreamFields(errorEnvelope);
          await xaddToStream(this.state.publishConnection, entry.replyTo, fields);
        }
      }
    };

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry,
      logger: this.logger,
      createdGroups: this.state.createdGroups,
    });
    this.state.consumerLoops.push(loop);

    this.state.consumerRegistrations.push({
      consumerTag: loop.consumerTag,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      callback: onEntry,
    });

    this.ownedConsumerTags.set(queue, loop.consumerTag);
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const queue = options?.queue ?? this.getDefaultQueue();
    const consumerTag = this.ownedConsumerTags.get(queue);

    if (consumerTag) {
      await stopConsumerLoop(this.state, consumerTag);

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      this.ownedConsumerTags.delete(queue);
    }
    this.registeredQueues.delete(queue);

    this.logger.debug("RPC handler unregistered", { queue });
  }

  public async unserveAll(): Promise<void> {
    for (const [queue, consumerTag] of this.ownedConsumerTags) {
      await stopConsumerLoop(this.state, consumerTag);

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      this.ownedConsumerTags.delete(queue);
    }

    this.registeredQueues.clear();

    this.logger.debug("All RPC handlers unregistered");
  }
}
