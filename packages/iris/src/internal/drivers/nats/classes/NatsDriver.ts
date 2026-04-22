import { EventEmitter } from "node:events";
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
  IrisConnectionState,
  IrisEvents,
  IrisHookMeta,
  NatsConnectionOptions,
} from "../../../../types/index.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { IAmphora } from "@lindorm/amphora";
import type { NatsConnection, NatsSharedState } from "../types/nats-types.js";
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
  context?: IrisHookMeta;
  amphora?: IAmphora;
  getSubscribers: () => Array<IMessageSubscriber>;
  servers: string | Array<string>;
  connection?: NatsConnectionOptions;
  prefix?: string;
  prefetch?: number;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class NatsDriver implements IIrisDriver {
  private readonly logger: ILogger;
  private readonly context: IrisHookMeta | undefined;
  private readonly amphora: IAmphora | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly state: NatsSharedState;
  private readonly servers: string | Array<string>;
  private readonly connectionOptions: Record<string, unknown>;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _emitter = new EventEmitter();
  private _replyQueueActive: boolean = false;
  private _deliberateDisconnect: boolean = false;
  private _statusMonitorAbort: AbortController | null = null;
  private _reconnecting: Promise<void> | null = null;

  public constructor(options: NatsDriverOptions, state?: NatsSharedState) {
    this.logger = options.logger.child(["NatsDriver"]);
    this.context = options.context;
    this.amphora = options.amphora;
    this.getSubscribers = options.getSubscribers;
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

  public async connect(): Promise<void> {
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
          const js = this.state.js;
          const hi = this.state.headersInit;
          if (!js || !hi) return;

          const baseSubject = resolveSubject(this.state.prefix, entry.topic);
          const subject = entry.envelope.broadcast
            ? `${baseSubject}.broadcast`
            : baseSubject;
          const { data } = serializeNatsMessage(entry.envelope, hi);

          await js.publish(subject, data);
        });
      }

      this.setConnectionState("connected");
      this.logger.debug("Connected");
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
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
    this.logger.debug("Disconnected");
  }

  public async drain(_timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    await stopAllNatsConsumers(this.state);

    // Poll inFlightCount until 0
    const timeout = _timeout ?? 5000;
    const pollInterval = 10;
    const deadline = Date.now() + timeout;

    while (this.state.inFlightCount > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pollInterval);
        t.unref();
      });
    }

    if (this.state.inFlightCount > 0) {
      this.logger.warn("Drain timeout reached with in-flight consumers remaining", {
        inFlightCount: this.state.inFlightCount,
        timeoutMs: timeout,
      });
    }

    await this.reRegisterConsumers();

    this.setConnectionState("connected");
    this.logger.debug("Drained");
  }

  public async ping(): Promise<boolean> {
    if (!this.state.nc) return false;

    try {
      await this.state.nc.flush();
      return true;
    } catch {
      return false;
    }
  }

  public async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    await ensureNatsStream({
      jsm: this.state.jsm!,
      streamName: this.state.streamName,
      subjects: [`${this.state.prefix}.>`],
      logger: this.logger,
    });
  }

  public async reset(): Promise<void> {
    await stopAllNatsConsumers(this.state);

    // Delete and recreate the stream so all durable consumers and messages are wiped.
    // Just purging leaves stale consumers whose deliver_policy offsets are wrong.
    if (this.state.jsm) {
      try {
        await this.state.jsm.streams.delete(this.state.streamName);
      } catch {
        // Stream may not exist
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

  public getConnectionState(): IrisConnectionState {
    return this._connectionState;
  }

  public on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.on(event, listener);
  }

  public off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.off(event, listener);
  }

  public once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.once(event, listener);
  }

  public createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return new NatsPublisher<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
    });
  }

  public createMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new NatsMessageBus<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new NatsWorkerQueue<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createStreamProcessor(): IIrisStreamProcessor {
    return new NatsStreamProcessor({
      state: this.state,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): NatsRpcClient<Req, Res> {
    return new NatsRpcClient({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): NatsRpcServer<Req, Res> {
    return new NatsRpcServer({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public async setupReplyQueue(): Promise<void> {
    this._replyQueueActive = true;
    this.logger.debug("Reply queue active");
  }

  public async teardownReplyQueue(): Promise<void> {
    this._replyQueueActive = false;
    this.logger.debug("Reply queue inactive");
  }

  public cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new NatsDriver(
      {
        logger: this.logger,
        context: this.context,
        amphora: this.amphora,
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

  public get connected(): boolean {
    return this._connectionState === "connected" || this._connectionState === "draining";
  }

  public get replyQueueActive(): boolean {
    return this._replyQueueActive;
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
                this.logger.debug("NATS reconnected");
                this.setConnectionState("connected");

                if (!this._reconnecting) {
                  this._reconnecting = stopAllNatsConsumers(this.state)
                    .then(() => this.reRegisterConsumers())
                    .catch((error) => {
                      this.logger.error(
                        "Failed to re-register consumers after reconnect",
                        {
                          error: error instanceof Error ? error.message : String(error),
                        },
                      );
                    })
                    .finally(() => {
                      this._reconnecting = null;
                    });
                }
              }
              break;

            case "disconnect":
              if (
                !this._deliberateDisconnect &&
                this._connectionState !== "reconnecting"
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

  private setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    this._emitter.emit("connection:state", state);
  }
}
