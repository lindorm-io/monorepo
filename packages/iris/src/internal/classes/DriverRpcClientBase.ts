import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisSerializationError } from "../../errors/IrisSerializationError.js";
import { IrisTimeoutError } from "../../errors/IrisTimeoutError.js";
import { IrisTransportError } from "../../errors/IrisTransportError.js";
import type { IIrisRpcClient, IMessage } from "../../interfaces/index.js";
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

const DEFAULT_TIMEOUT_MS = 30_000;

export type DriverRpcClientBaseOptions<Req extends IMessage, Res extends IMessage> = {
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
};

export type PendingRequest<Res> = {
  resolve: (res: Res) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  cleanup: () => void;
};

export abstract class DriverRpcClientBase<
  Req extends IMessage,
  Res extends IMessage,
> implements IIrisRpcClient<Req, Res> {
  protected readonly logger: ILogger;
  protected readonly requestMetadata: MessageMetadata;
  protected readonly responseMetadata: MessageMetadata;
  protected readonly requestManager: MessageManager<Req>;
  protected readonly responseManager: MessageManager<Res>;
  protected readonly encryption: MessageEncryptionContext | undefined;
  protected readonly pendingRequests: Map<string, PendingRequest<Res>> = new Map();

  protected constructor(
    options: DriverRpcClientBaseOptions<Req, Res>,
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

  abstract request(message: Req, options?: { timeout?: number }): Promise<Res>;

  abstract close(): Promise<void>;

  protected async prepareRequestEnvelope(
    message: Req,
  ): Promise<{ envelope: IrisEnvelope; topic: string }> {
    this.requestManager.validate(message);
    const outbound = await prepareOutbound(
      message,
      this.requestMetadata,
      this.encryption,
    );
    const topic = resolveDefaultTopic(this.requestMetadata);
    const envelope = buildEnvelope(
      outbound,
      topic,
      this.requestMetadata,
      undefined,
      true,
    );
    return { envelope, topic };
  }

  protected getDefaultTimeout(options?: { timeout?: number }): number {
    return options?.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  protected registerPendingRequest(
    correlationId: string,
    topic: string,
    timeoutMs: number,
    extraCleanup?: () => void,
  ): { promise: Promise<Res>; cleanup: () => void } {
    let resolveFn: (res: Res) => void;
    let rejectFn: (err: Error) => void;

    const promise = new Promise<Res>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const cleanup = (): void => {
      this.pendingRequests.delete(correlationId);
      clearTimeout(timer);
      extraCleanup?.();
    };

    const timer = setTimeout(() => {
      cleanup();
      rejectFn!(
        new IrisTimeoutError(
          `RPC request timed out after ${timeoutMs}ms for topic "${topic}"`,
          { debug: { topic, correlationId, timeoutMs } },
        ),
      );
    }, timeoutMs);
    timer.unref();

    this.pendingRequests.set(correlationId, {
      resolve: resolveFn!,
      reject: rejectFn!,
      timer,
      cleanup,
    });

    return { promise, cleanup };
  }

  protected async handleReplyPayload(
    correlationId: string,
    payload: Buffer,
    headers: Record<string, string>,
  ): Promise<void> {
    const pending = this.pendingRequests.get(correlationId);
    if (!pending) return;

    pending.cleanup();

    if (headers["x-iris-rpc-error"] === "true") {
      const errorMessage = headers["x-iris-rpc-error-message"] ?? "RPC handler error";
      pending.reject(this.buildRemoteHandlerError(errorMessage, correlationId));
      return;
    }

    try {
      const data = await prepareInbound(
        payload,
        headers,
        this.responseMetadata,
        this.encryption,
      );
      const response = this.responseManager.hydrate(data);
      pending.resolve(response);
    } catch (error) {
      pending.reject(
        error instanceof Error
          ? error
          : new IrisSerializationError("Failed to deserialize RPC response", {
              debug: { correlationId },
            }),
      );
    }
  }

  /**
   * The typed error every driver rejects with when a remote RPC *handler*
   * threw. Kept on the base so redis/kafka/memory (via {@link handleReplyPayload})
   * and rabbit's inline reply consumer surface the SAME `IrisTransportError`
   * (`rpc_handler_error`) — matching nats — instead of a bare `Error`.
   */
  protected buildRemoteHandlerError(
    message: string,
    correlationId: string | null,
  ): IrisTransportError {
    const topic = resolveDefaultTopic(this.requestMetadata);
    return new IrisTransportError(message, {
      code: "rpc_handler_error",
      title: "RPC Handler Error",
      details: `The remote RPC handler for topic "${topic}" returned an error response.`,
      data: { topic },
      debug: { correlationId },
    });
  }

  protected rejectAllPending(): void {
    const closedError = new IrisTransportError(
      "RPC client closed while request was pending",
    );
    for (const [, pending] of this.pendingRequests) {
      pending.cleanup();
      pending.reject(closedError);
    }
    this.pendingRequests.clear();
  }
}
