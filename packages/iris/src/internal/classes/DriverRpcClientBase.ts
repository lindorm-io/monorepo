import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisSerializationError } from "../../errors/IrisSerializationError.js";
import { IrisTimeoutError } from "../../errors/IrisTimeoutError.js";
import { IrisTransportError } from "../../errors/IrisTransportError.js";
import type { IIrisRpcClient, IMessage } from "../../interfaces/index.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import type { IAmphora } from "@lindorm/amphora";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import { resolveDefaultTopic } from "../message/utils/resolve-default-topic.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import { createDefaultEnvelope } from "../utils/create-default-envelope.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export type DriverRpcClientBaseOptions<Req extends IMessage, Res extends IMessage> = {
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
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
  protected readonly amphora: IAmphora | undefined;
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

  public abstract request(message: Req, options?: { timeout?: number }): Promise<Res>;

  public abstract close(): Promise<void>;

  protected async prepareRequestEnvelope(
    message: Req,
  ): Promise<{ envelope: IrisEnvelope; topic: string }> {
    this.requestManager.validate(message);
    const outbound = await prepareOutbound(message, this.requestMetadata, this.amphora);
    const topic = resolveDefaultTopic(this.requestMetadata);
    const envelope = createDefaultEnvelope(outbound, topic);
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
      pending.reject(new Error(errorMessage));
      return;
    }

    try {
      const data = await prepareInbound(
        payload,
        headers,
        this.responseMetadata,
        this.amphora,
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
