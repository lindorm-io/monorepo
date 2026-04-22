import { randomUUID } from "@lindorm/random";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { RedisSharedState } from "../types/redis-types.js";
import { DriverRpcClientBase } from "../../../classes/DriverRpcClientBase.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { serializeStreamFields } from "../utils/serialize-stream-fields.js";
import { xaddToStream } from "../utils/xadd-to-stream.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { stopConsumerLoop } from "../utils/stop-consumer-loop.js";

export type RedisRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  state: RedisSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  amphora?: IAmphora;
};

export class RedisRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private readonly state: RedisSharedState;
  private readonly replyStreamKey: string;
  private replyConsumerPromise: Promise<void> | null = null;
  private replyGroupName: string | null = null;

  public constructor(options: RedisRpcClientOptions<Req, Res>) {
    super(options, "RedisRpcClient");
    this.state = options.state;
    this.replyStreamKey = `${this.state.prefix}:rpc:reply:${randomUUID()}`;
  }

  public async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);
    const correlationId = randomUUID();

    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot send RPC request: connection is not available");
    }

    await this.ensureReplyConsumer();

    const { envelope, topic } = await this.prepareRequestEnvelope(message);
    envelope.replyTo = this.replyStreamKey;
    envelope.correlationId = correlationId;

    const { promise } = this.registerPendingRequest(correlationId, topic, timeoutMs);

    const streamKey = resolveStreamKey(this.state.prefix, `rpc:${topic}`);
    const fields = serializeStreamFields(envelope);

    await xaddToStream(
      this.state.publishConnection,
      streamKey,
      fields,
      this.state.maxStreamLength,
    );

    return promise;
  }

  public async close(): Promise<void> {
    this.rejectAllPending();

    const replyLoop = this.state.consumerLoops.find(
      (l) => l.streamKey === this.replyStreamKey,
    );
    if (replyLoop) {
      await stopConsumerLoop(this.state, replyLoop.consumerTag);
    }

    if (this.state.publishConnection) {
      try {
        if (this.replyGroupName) {
          await this.state.publishConnection.xgroup(
            "DESTROY",
            this.replyStreamKey,
            this.replyGroupName,
          );
        }
        await this.state.publishConnection.del(this.replyStreamKey);
      } catch {
        // Stream or group may already be gone
      }
    }

    this.replyConsumerPromise = null;
    this.replyGroupName = null;
    this.logger.debug("RPC client closed");
  }

  private async ensureReplyConsumer(): Promise<void> {
    this.replyConsumerPromise ??= this.doEnsureReplyConsumer().catch((err) => {
      this.replyConsumerPromise = null;
      throw err;
    });
    await this.replyConsumerPromise;
  }

  private async doEnsureReplyConsumer(): Promise<void> {
    this.replyGroupName = `${this.state.prefix}.rpc.reply.${randomUUID()}`;

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection!,
      streamKey: this.replyStreamKey,
      groupName: this.replyGroupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      createdGroups: this.state.createdGroups,
      onEntry: async (entry) => {
        const cid = entry.correlationId;
        if (!cid) return;

        await this.handleReplyPayload(cid, entry.payload, entry.headers);
      },
      logger: this.logger,
    });
    this.state.consumerLoops.push(loop);
  }
}
