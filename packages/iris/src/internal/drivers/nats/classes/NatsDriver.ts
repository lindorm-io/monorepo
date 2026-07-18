import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../../../interfaces/IrisDriver.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../../../interfaces/index.js";
import type {
  IrisCapabilities,
  IrisHookMeta,
  NatsConnectionOptions,
} from "../../../../types/index.js";
import { NATS_CAPABILITIES } from "../nats-capabilities.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../../../types/dead-letter.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { MessageEncryptionContext } from "../../../message/types/encryption-context.js";
import { ConnectionDriverBase } from "../../../classes/ConnectionDriverBase.js";
import type { NatsConnection, NatsSharedState } from "../types/nats-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import { IrisTimeoutError } from "../../../../errors/IrisTimeoutError.js";
import { resolveBroadcastDestination } from "../../../utils/resolve-broadcast-destination.js";
import { createNatsConsumer } from "../utils/create-nats-consumer.js";
import { ensureNatsStream } from "../utils/ensure-nats-stream.js";
import { resolveSubject } from "../utils/resolve-subject.js";
import { serializeNatsMessage } from "../utils/serialize-nats-message.js";
import { stopAllNatsConsumers } from "../utils/stop-nats-consumer.js";
import { NatsMessageBus } from "./NatsMessageBus.js";
import { NatsPublisher } from "./NatsPublisher.js";
import { NatsRpcClient } from "./NatsRpcClient.js";
import { NatsRpcServer } from "./NatsRpcServer.js";
import { NatsStreamProcessor } from "./NatsStreamProcessor.js";
import { NatsWorkerQueue } from "./NatsWorkerQueue.js";

const DEFAULT_PREFETCH = 10;
const DEFAULT_PREFIX = "iris";

const resolveStreamName = (prefix: string): string => {
  return `IRIS_${prefix.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
};

export type NatsDriverOptions = {
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
  servers: string | Array<string>;
  connection?: NatsConnectionOptions;
  prefix?: string;
  prefetch?: number;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class NatsDriver extends ConnectionDriverBase {
  readonly capabilities: IrisCapabilities = NATS_CAPABILITIES;
  private readonly state: NatsSharedState;
  private readonly servers: string | Array<string>;
  private readonly connectionOptions: Record<string, unknown>;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _deliberateDisconnect: boolean = false;
  private _statusMonitorAbort: AbortController | null = null;

  constructor(options: NatsDriverOptions, state?: NatsSharedState) {
    super({
      driverType: "nats",
      loggerLabel: "NatsDriver",
      logger: options.logger,
      meta: options.meta,
      encryption: options.encryption,
      getSubscribers: options.getSubscribers,
    });
    this.servers = options.servers;
    this.connectionOptions = options.connection ?? {};
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;

    const prefix = options.prefix ?? DEFAULT_PREFIX;

    this.state = state ?? {
      nc: null,
      js: null,
      jsm: null,
      headersInit: null,
      prefix,
      streamName: resolveStreamName(prefix),
      consumerLoops: [],
      consumerRegistrations: [],
      ensuredConsumers: new Set(),
      inFlightCount: 0,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
    };
  }

  protected async doConnect(): Promise<void> {
    this._deliberateDisconnect = false;
    this.setConnectionState("connecting");

    try {
      const nats = await import("nats");

      const connectOpts: Record<string, unknown> = {
        servers: this.servers,
        ...this.connectionOptions,
      };

      const nc = await nats.connect(connectOpts);
      const js = nc.jetstream();
      const jsm = await nc.jetstreamManager();
      const headersInit = nats.headers;

      this.state.nc = nc as unknown as NatsConnection;
      this.state.js = js as any;
      this.state.jsm = jsm as any;
      this.state.headersInit = headersInit as any;

      this.monitorConnectionStatus(nc as unknown as NatsConnection);

      if (this.delayManager) {
        this.delayManager.start(async (entry) => {
          // Throw (do NOT silently no-op) when the JetStream connection is
          // unavailable at fire time, so the DelayManager keeps the entry and
          // retries it on the next poll instead of dropping the delayed message.
          const js = this.state.js;
          const hi = this.state.headersInit;
          if (!js || !hi) {
            throw new IrisPublishError("NATS JetStream connection not available", {
              code: "publish_connection_unavailable",
              title: "Publish Connection Unavailable",
              details:
                "The NATS JetStream connection is not established, so the delayed message cannot be delivered.",
              data: { driver: "nats" },
            });
          }

          // Route a delayed broadcast to the broadcast subject, exactly as the
          // non-delayed publish path does.
          const subject = resolveBroadcastDestination(
            resolveSubject(this.state.prefix, entry.topic),
            entry.envelope.broadcast,
            ".",
          );
          const { data } = serializeNatsMessage(entry.envelope, hi);

          await js.publish(subject, data);
        });
      }

      this.setConnectionState("connected");
      this.logger.info("Connected");
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this._deliberateDisconnect = true;

    if (this.delayManager) {
      this.delayManager.stop();
    }

    if (this._statusMonitorAbort) {
      this._statusMonitorAbort.abort();
      this._statusMonitorAbort = null;
    }

    await stopAllNatsConsumers(this.state);

    if (this.state.nc) {
      try {
        await this.state.nc.close();
      } catch {
        // Connection may already be closed
      }
      this.state.nc = null;
      this.state.js = null;
      this.state.jsm = null;
      this.state.headersInit = null;
    }

    this._replyQueueActive = false;
    this.setConnectionState("disconnected");
    this.logger.info("Disconnected");
  }

  protected getInFlightCount(): number {
    return this.state.inFlightCount;
  }

  protected async beforeDrain(): Promise<void> {
    await stopAllNatsConsumers(this.state);
  }

  protected async afterDrain(): Promise<void> {
    await this.reRegisterConsumers();
  }

  async ping(): Promise<boolean> {
    if (!this.state.nc) return false;

    try {
      await this.state.nc.flush();
      return true;
    } catch {
      return false;
    }
  }

  async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    await ensureNatsStream({
      jsm: this.state.jsm!,
      streamName: this.state.streamName,
      subjects: [`${this.state.prefix}.>`],
      logger: this.logger,
    });
  }

  async reset(): Promise<void> {
    await stopAllNatsConsumers(this.state);

    // Delete and recreate the stream so all durable consumers and messages
    // are wiped. Just purging leaves stale consumers whose deliver_policy
    // offsets are wrong.
    //
    // Order matters for race-free reset under fast loops (TCK beforeEach):
    //   1. Purge first — drops any messages whose pulls were still in flight
    //      when stopAllNatsConsumers returned.
    //   2. Delete the stream.
    //   3. Poll streams.info() until it reports "not found" before recreating.
    //      Without this, ensureNatsStream's "create if missing" can race the
    //      cluster-side delete and either fail or create against a half-gone
    //      stream definition.
    if (this.state.jsm) {
      try {
        await this.state.jsm.streams.purge(this.state.streamName);
      } catch {
        // Stream may not exist
      }
      let deleted = false;
      try {
        await this.state.jsm.streams.delete(this.state.streamName);
        deleted = true;
      } catch {
        // Stream may not exist (or delete genuinely failed). Either way,
        // ensureNatsStream below will reconcile by creating only if missing.
      }
      if (deleted) {
        // Only wait when delete succeeded — otherwise the stream may still
        // be there and waitForStreamGone would spin until timeout.
        await this.waitForStreamGone(this.state.streamName, 5000);
      }
      await ensureNatsStream({
        jsm: this.state.jsm,
        streamName: this.state.streamName,
        subjects: [`${this.state.prefix}.>`],
        logger: this.logger,
      });
    }

    this.state.consumerRegistrations.length = 0;
    this.state.ensuredConsumers.clear();
    this._replyQueueActive = false;

    this.logger.debug("Reset");
  }

  private async waitForStreamGone(streamName: string, timeoutMs: number): Promise<void> {
    if (!this.state.jsm) return;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        await this.state.jsm.streams.info(streamName);
      } catch (err: any) {
        if (String(err?.message).includes("stream not found") || err?.code === "404") {
          return;
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new IrisTimeoutError(
      `waitForStreamGone: ${streamName} still exists after ${timeoutMs}ms`,
      {
        code: "stream_deletion_timeout",
        title: "Stream Deletion Timeout",
        details: `The JetStream stream "${streamName}" still existed after waiting ${timeoutMs}ms for its deletion to propagate.`,
        data: { driver: "nats", streamName, timeoutMs },
      },
    );
  }

  async getDeadLetters(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    if (!this.deadLetterManager) return [];
    return this.deadLetterManager.list(options);
  }

  async purgeDeadLetters(options?: DeadLetterFilterOptions): Promise<number> {
    if (!this.deadLetterManager) return 0;
    return this.deadLetterManager.purge(options);
  }

  protected buildPublisher<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisPublisher<M> {
    return new NatsPublisher<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
    });
  }

  protected buildMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new NatsMessageBus<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new NatsWorkerQueue<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildStreamProcessor(): IIrisStreamProcessor {
    return new NatsStreamProcessor({
      state: this.state,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
    });
  }

  protected buildRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): NatsRpcClient<Req, Res> {
    return new NatsRpcClient({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  protected buildRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): NatsRpcServer<Req, Res> {
    return new NatsRpcServer({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new NatsDriver(
      {
        logger: this.logger,
        meta: this.meta,
        encryption: this.encryption,
        getSubscribers,
        servers: this.servers,
        connection: this.connectionOptions,
        prefix: this.state.prefix,
        prefetch: this.state.prefetch,
        delayManager: this.delayManager,
        deadLetterManager: this.deadLetterManager,
      },
      this.state,
    );
  }

  private async reRegisterConsumers(): Promise<void> {
    if (!this.state.js) return;

    const registrations = [...this.state.consumerRegistrations];

    for (const reg of registrations) {
      try {
        const loop = await createNatsConsumer({
          js: this.state.js,
          jsm: this.state.jsm!,
          streamName: this.state.streamName,
          consumerName: reg.consumerName,
          subject: reg.subject,
          prefetch: this.state.prefetch,
          onMessage: reg.callback,
          logger: this.logger,
          ensuredConsumers: this.state.ensuredConsumers,
          deliverPolicy: reg.deliverPolicy,
          maxDeliver: reg.maxDeliver,
        });
        this.state.consumerLoops.push(loop);

        // Update the registration's consumerTag to match the new loop
        reg.consumerTag = loop.consumerTag;
      } catch (error) {
        this.logger.error("Failed to re-register consumer", {
          consumerName: reg.consumerName,
          subject: reg.subject,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private monitorConnectionStatus(nc: NatsConnection): void {
    if (this._statusMonitorAbort) {
      this._statusMonitorAbort.abort();
    }

    const abortController = new AbortController();
    this._statusMonitorAbort = abortController;

    // nc.status() returns an async iterable of { type, data? }
    void (async (): Promise<void> => {
      try {
        for await (const status of nc.status()) {
          if (abortController.signal.aborted) break;

          const type = String(status.type);

          switch (type) {
            case "reconnecting":
            case "staleconnection":
              if (!this._deliberateDisconnect) {
                this.logger.debug("NATS reconnecting", { type });
                this.setConnectionState("reconnecting");
              }
              break;

            case "reconnect":
              if (!this._deliberateDisconnect) {
                this.logger.info("NATS reconnected");
                this.setConnectionState("connected");

                this.triggerReRegister(() =>
                  stopAllNatsConsumers(this.state).then(() => this.reRegisterConsumers()),
                );
              }
              break;

            case "disconnect":
              if (
                !this._deliberateDisconnect &&
                this.getConnectionState() !== "reconnecting"
              ) {
                this.logger.warn("NATS disconnected unexpectedly");
                this.setConnectionState("reconnecting");
              }
              break;

            case "error":
              this.logger.error("NATS connection error", {
                data: String(status.data ?? ""),
              });
              break;

            default:
              this.logger.debug("NATS status event", { type });
              break;
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        this.logger.error("Status monitor failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }
}
