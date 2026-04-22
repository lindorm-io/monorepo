import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { NatsSharedState, NatsSubscription } from "../types/nats-types.js";
import { DriverRpcServerBase } from "../../../classes/DriverRpcServerBase.js";
import { serializeNatsMessage } from "../utils/serialize-nats-message.js";
import { parseNatsMessage } from "../utils/parse-nats-message.js";

export type NatsRpcServerOptions<Req extends IMessage, Res extends IMessage> = {
  state: NatsSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: IrisHookMeta;
  amphora?: IAmphora;
};

export class NatsRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  private readonly state: NatsSharedState;
  private readonly ownedSubscriptions: Map<string, NatsSubscription> = new Map();

  public constructor(options: NatsRpcServerOptions<Req, Res>) {
    super(options, "NatsRpcServer");
    this.state = options.state;
  }

  protected async doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    if (!this.state.nc || !this.state.headersInit) {
      throw new IrisDriverError("Cannot serve RPC: connection is not available");
    }

    // Use _rpc_ prefix to keep RPC outside the JetStream stream ({prefix}.>)
    const subject = `_rpc_.${this.state.prefix}.${topic}`;

    const subscription = this.state.nc.subscribe(subject, {
      queue,
      callback: async (_err, msg) => {
        if (!msg) return;

        let correlationId: string | null = null;

        try {
          const requestEnvelope = parseNatsMessage(msg.data);
          correlationId = requestEnvelope.correlationId;
          const { responseEnvelope } = await this.processRequest(
            handler,
            requestEnvelope.payload,
            requestEnvelope.headers,
            queue,
          );
          responseEnvelope.correlationId = correlationId;

          const { data } = serializeNatsMessage(
            responseEnvelope,
            this.state.headersInit!,
          );
          msg.respond(data);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error("RPC handler error", { error: err.message, queue });

          const errorEnvelope = this.buildErrorEnvelope(queue, err, correlationId);
          const { data } = serializeNatsMessage(errorEnvelope, this.state.headersInit!);
          msg.respond(data);
        }
      },
    });

    this.ownedSubscriptions.set(queue, subscription);
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const queue = options?.queue ?? this.getDefaultQueue();
    const subscription = this.ownedSubscriptions.get(queue);

    if (subscription) {
      subscription.unsubscribe();
      this.ownedSubscriptions.delete(queue);
    }
    this.registeredQueues.delete(queue);

    this.logger.debug("RPC handler unregistered", { queue });
  }

  public async unserveAll(): Promise<void> {
    for (const [queue, subscription] of this.ownedSubscriptions) {
      subscription.unsubscribe();
      this.ownedSubscriptions.delete(queue);
    }

    this.registeredQueues.clear();

    this.logger.debug("All RPC handlers unregistered");
  }
}
