import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../errors/IrisDriverError.js";
import type { IIrisRpcServer, IMessage } from "../../interfaces/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import { resolveDefaultTopic } from "../message/utils/resolve-default-topic.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import { buildEnvelope } from "../utils/build-envelope.js";

export type DriverRpcServerBaseSettings<Req extends IMessage, Res extends IMessage> = {
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
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
  protected readonly encryption: MessageEncryptionContext | undefined;
  protected readonly registeredQueues: Set<string> = new Set();

  protected constructor(
    options: DriverRpcServerBaseSettings<Req, Res>,
    loggerLabel: string,
  ) {
    this.logger = options.logger.child([loggerLabel]);
    this.requestMetadata = getMessageMetadata(options.requestTarget);
    this.responseMetadata = getMessageMetadata(options.responseTarget);
    this.requestManager = new MessageManager<Req>({
      target: options.requestTarget,
      meta: options.meta,
      logger: options.logger,
    });
    this.responseManager = new MessageManager<Res>({
      target: options.responseTarget,
      meta: options.meta,
      logger: options.logger,
    });
    this.encryption = options.encryption;
  }

  async serve(
    handler: (request: Req) => Promise<Res>,
    options?: { queue?: string },
  ): Promise<void> {
    const topic = resolveDefaultTopic(this.requestMetadata);
    const queue = options?.queue ?? topic;

    if (this.registeredQueues.has(queue)) {
      throw new IrisDriverError(`RPC handler already registered for queue "${queue}"`, {
        code: "rpc_handler_already_registered",
        title: "RPC Handler Already Registered",
        details:
          "An RPC handler is already registered for the named queue. Each queue may have only one handler; unserve the existing one first.",
        data: { queue },
      });
    }

    await this.doServe(queue, topic, handler);
    this.registeredQueues.add(queue);

    this.logger.debug("RPC handler registered", { queue });
  }

  abstract unserve(options?: { queue?: string }): Promise<void>;
  abstract unserveAll(): Promise<void>;

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
      this.encryption,
    );
    const request = this.requestManager.hydrate(data);

    this.logger.debug("Processing RPC request", { queue });

    const response = await handler(request);

    this.responseManager.validate(response);
    const outbound = await prepareOutbound(
      response,
      this.responseMetadata,
      this.encryption,
    );

    const responseEnvelope = buildEnvelope(
      outbound,
      queue,
      this.responseMetadata,
      undefined,
      true,
    );
    return { responseEnvelope };
  }

  protected buildErrorEnvelope(
    queue: string,
    error: Error,
    correlationId: string | null,
  ): IrisEnvelope {
    const envelope = buildEnvelope(
      {
        payload: Buffer.from(JSON.stringify({ error: error.message })),
        headers: {
          "x-iris-rpc-error": "true",
          "x-iris-rpc-error-message": error.message,
        },
      },
      queue,
      this.responseMetadata,
      undefined,
      true,
    );
    envelope.correlationId = correlationId;
    return envelope;
  }

  protected abstract doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void>;
}
