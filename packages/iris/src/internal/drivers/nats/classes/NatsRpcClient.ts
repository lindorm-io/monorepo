import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { IrisTimeoutError } from "../../../../errors/IrisTimeoutError";
import { IrisTransportError } from "../../../../errors/IrisTransportError";
import type { IMessage } from "../../../../interfaces";
import type { IAmphora } from "@lindorm/amphora";
import type { NatsSharedState } from "../types/nats-types";
import { DriverRpcClientBase } from "../../../classes/DriverRpcClientBase";
import { serializeNatsMessage } from "../utils/serialize-nats-message";
import { parseNatsMessage } from "../utils/parse-nats-message";
import { prepareInbound } from "../../../message/utils/prepare-inbound";

export type NatsRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  state: NatsSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

export class NatsRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private readonly state: NatsSharedState;

  public constructor(options: NatsRpcClientOptions<Req, Res>) {
    super(options, "NatsRpcClient");
    this.state = options.state;
  }

  public async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);

    if (!this.state.nc || !this.state.headersInit) {
      throw new IrisDriverError("Cannot send RPC request: connection is not available");
    }

    const { envelope, topic } = await this.prepareRequestEnvelope(message);

    // Use _rpc_ prefix to keep RPC outside the JetStream stream ({prefix}.>)
    const subject = `_rpc_.${this.state.prefix}.${topic}`;
    const { data } = serializeNatsMessage(envelope, this.state.headersInit);

    try {
      const reply = await this.state.nc.request(subject, data, { timeout: timeoutMs });
      const replyEnvelope = parseNatsMessage(reply.data);

      if (replyEnvelope.headers["x-iris-rpc-error"] === "true") {
        const errorMessage =
          replyEnvelope.headers["x-iris-rpc-error-message"] ?? "RPC handler error";
        throw new Error(errorMessage);
      }

      const inboundData = await prepareInbound(
        replyEnvelope.payload,
        replyEnvelope.headers,
        this.responseMetadata,
        this.amphora,
      );
      return this.responseManager.hydrate(inboundData);
    } catch (error) {
      if (error instanceof IrisTimeoutError || error instanceof IrisTransportError) {
        throw error;
      }
      const code = (error as any)?.code;
      const msg = error instanceof Error ? error.message : String(error);
      if (code === "TIMEOUT" || msg.includes("TIMEOUT") || msg.includes("timeout")) {
        throw new IrisTimeoutError(
          `RPC request timed out after ${timeoutMs}ms for topic "${topic}"`,
          { debug: { topic, timeoutMs } },
        );
      }
      if (
        code === "503" ||
        code === "NO_RESPONDERS" ||
        msg.includes("NO_RESPONDERS") ||
        msg.includes("no responders")
      ) {
        throw new IrisTransportError(`No RPC handler registered for topic "${topic}"`, {
          debug: { topic },
        });
      }
      throw error;
    }
  }

  public async close(): Promise<void> {
    this.rejectAllPending();
    this.logger.debug("RPC client closed");
  }
}
