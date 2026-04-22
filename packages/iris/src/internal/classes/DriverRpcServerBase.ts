import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../errors/IrisDriverError.js";
import type { IIrisRpcServer, IMessage } from "../../interfaces/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import type { IAmphora } from "@lindorm/amphora";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import { resolveDefaultTopic } from "../message/utils/resolve-default-topic.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import { createDefaultEnvelope } from "../utils/create-default-envelope.js";

export type DriverRpcServerBaseOptions<Req extends IMessage, Res extends IMessage> = {
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: IrisHookMeta;
  amphora?: IAmphora;
};

export abstract class DriverRpcServerBase<
  Req extends IMessage,
  Res extends IMessage,
> implements IIrisRpcServer<Req, Res> {
  protected readonly logger: ILogger;
  protected readonly requestMetadata: MessageMetadata;
  protected readonly responseMetadata: MessageMetadata;
  protected readonly requestManager: MessageManager<Req>;
  protected readonly responseManager: MessageManager<Res>;
  protected readonly amphora: IAmphora | undefined;
  protected readonly registeredQueues: Set<string> = new Set();

  protected constructor(
    options: DriverRpcServerBaseOptions<Req, Res>,
    loggerLabel: string,
  ) {
    this.logger = options.logger.child([loggerLabel]);
    this.requestMetadata = getMessageMetadata(options.requestTarget);
    this.responseMetadata = getMessageMetadata(options.responseTarget);
    this.requestManager = new MessageManager<Req>({
      target: options.requestTarget,
      context: options.context,
      logger: options.logger,
    });
    this.responseManager = new MessageManager<Res>({
      target: options.responseTarget,
      context: options.context,
      logger: options.logger,
    });
    this.amphora = options.amphora;
  }

  public async serve(
    handler: (request: Req) => Promise<Res>,
    options?: { queue?: string },
  ): Promise<void> {
    const topic = resolveDefaultTopic(this.requestMetadata);
    const queue = options?.queue ?? topic;

    if (this.registeredQueues.has(queue)) {
      throw new IrisDriverError(`RPC handler already registered for queue "${queue}"`, {
        debug: { queue },
      });
    }

    await this.doServe(queue, topic, handler);
    this.registeredQueues.add(queue);

    this.logger.debug("RPC handler registered", { queue });
  }

  public abstract unserve(options?: { queue?: string }): Promise<void>;
  public abstract unserveAll(): Promise<void>;

  protected getDefaultQueue(): string {
    return resolveDefaultTopic(this.requestMetadata);
  }

  protected async processRequest(
    handler: (request: Req) => Promise<Res>,
    payload: Buffer,
    headers: Record<string, string>,
    queue: string,
  ): Promise<{ responseEnvelope: IrisEnvelope }> {
    const data = await prepareInbound(
      payload,
      headers,
      this.requestMetadata,
      this.amphora,
    );
    const request = this.requestManager.hydrate(data);

    this.logger.debug("Processing RPC request", { queue });

    const response = await handler(request);

    this.responseManager.validate(response);
    const outbound = await prepareOutbound(response, this.responseMetadata, this.amphora);

    const responseEnvelope = createDefaultEnvelope(outbound, queue);
    return { responseEnvelope };
  }

  protected buildErrorEnvelope(
    queue: string,
    error: Error,
    correlationId: string | null,
  ): IrisEnvelope {
    return createDefaultEnvelope(
      {
        payload: Buffer.from(JSON.stringify({ error: error.message })),
        headers: {
          "x-iris-rpc-error": "true",
          "x-iris-rpc-error-message": error.message,
        },
      },
      queue,
      { correlationId },
    );
  }

  protected abstract doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void>;
}
