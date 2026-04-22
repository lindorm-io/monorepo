import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import type { IAmphora } from "@lindorm/amphora";
import { DriverRpcServerBase } from "../../../classes/DriverRpcServerBase.js";
import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store.js";

export type MemoryRpcServerOptions<Req extends IMessage, Res extends IMessage> = {
  store: MemorySharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  amphora?: IAmphora;
};

export class MemoryRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  private readonly store: MemorySharedState;
  private readonly ownedHandlers: Map<
    string,
    (envelope: MemoryEnvelope) => Promise<MemoryEnvelope>
  > = new Map();

  public constructor(options: MemoryRpcServerOptions<Req, Res>) {
    super(options, "MemoryRpcServer");
    this.store = options.store;
  }

  protected async doServe(
    queue: string,
    _topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    const wrappedHandler = async (envelope: MemoryEnvelope): Promise<MemoryEnvelope> => {
      try {
        const { responseEnvelope } = await this.processRequest(
          handler,
          envelope.payload,
          envelope.headers,
          queue,
        );
        return responseEnvelope;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("RPC handler error", { error: err.message, queue });
        return this.buildErrorEnvelope(queue, err, envelope.correlationId ?? null);
      }
    };

    this.ownedHandlers.set(queue, wrappedHandler);

    this.store.rpcHandlers.push({
      queue,
      handler: wrappedHandler,
    });
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const queue = options?.queue ?? this.getDefaultQueue();
    const ownedHandler = this.ownedHandlers.get(queue);
    if (ownedHandler) {
      this.store.rpcHandlers = this.store.rpcHandlers.filter(
        (h) => h.handler !== ownedHandler,
      );
      this.ownedHandlers.delete(queue);
    }
    this.registeredQueues.delete(queue);

    this.logger.debug("RPC handler unregistered", { queue });
  }

  public async unserveAll(): Promise<void> {
    for (const [, ownedHandler] of this.ownedHandlers) {
      this.store.rpcHandlers = this.store.rpcHandlers.filter(
        (h) => h.handler !== ownedHandler,
      );
    }
    this.ownedHandlers.clear();
    this.registeredQueues.clear();

    this.logger.debug("All RPC handlers unregistered");
  }
}
