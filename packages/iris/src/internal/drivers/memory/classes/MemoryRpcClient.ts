import { randomUUID } from "@lindorm/random";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisTransportError } from "../../../../errors/IrisTransportError";
import type { IMessage } from "../../../../interfaces";
import type { IAmphora } from "@lindorm/amphora";
import { DriverRpcClientBase } from "../../../classes/DriverRpcClientBase";
import type { MemorySharedState } from "../types/memory-store";

export type MemoryRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  store: MemorySharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

export class MemoryRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private readonly store: MemorySharedState;

  public constructor(options: MemoryRpcClientOptions<Req, Res>) {
    super(options, "MemoryRpcClient");
    this.store = options.store;
  }

  public async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);
    const correlationId = randomUUID();

    const { envelope, topic } = await this.prepareRequestEnvelope(message);
    envelope.replyTo = "__rpc_reply__";
    envelope.correlationId = correlationId;

    const handler = this.store.rpcHandlers.find((h) => h.queue === topic);

    if (!handler) {
      throw new IrisTransportError(`No RPC handler registered for queue "${topic}"`, {
        debug: { topic, correlationId },
      });
    }

    const { promise, cleanup } = this.registerPendingRequest(
      correlationId,
      topic,
      timeoutMs,
      () => {
        this.store.replyCallbacks.delete(correlationId);
        this.store.pendingRejects.delete(correlationId);
      },
    );

    const pending = this.pendingRequests.get(correlationId);
    if (pending) {
      this.store.timers.add(pending.timer);
      this.store.pendingRejects.set(correlationId, pending.reject);
    }

    this.store.replyCallbacks.set(correlationId, async (replyEnvelope) => {
      await this.handleReplyPayload(
        correlationId,
        replyEnvelope.payload,
        replyEnvelope.headers,
      );
    });

    handler
      .handler(envelope)
      .then(async (replyEnvelope) => {
        const cb = this.store.replyCallbacks.get(correlationId);
        if (cb) {
          await cb(replyEnvelope);
        }
      })
      .catch((error) => {
        const p = this.pendingRequests.get(correlationId);
        if (!p) return;
        cleanup();
        p.reject(
          error instanceof Error
            ? error
            : new IrisTransportError("RPC handler error", {
                debug: { correlationId, topic },
              }),
        );
      });

    return promise;
  }

  public async close(): Promise<void> {
    for (const [, pending] of this.pendingRequests) {
      this.store.timers.delete(pending.timer);
    }

    this.rejectAllPending();
    this.logger.debug("RPC client closed");
  }
}
