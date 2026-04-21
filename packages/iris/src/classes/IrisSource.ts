import { isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisNotSupportedError } from "../errors/IrisNotSupportedError.js";
import { IrisSourceError } from "../errors/IrisSourceError.js";
import type { IIrisDriver } from "../interfaces/IrisDriver.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisRpcServer,
  IIrisSource,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../interfaces/index.js";
import type {
  IrisConnectionState,
  IrisDriverType,
  IrisEvents,
  IrisSourceOptions,
  MessageScannerInput,
  SessionOptions,
} from "../types/index.js";
import type { DeadLetterManager } from "../internal/dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../internal/delay/DelayManager.js";
import { MessageScanner } from "../internal/message/classes/MessageScanner.js";
import { isAbstractMessage } from "../internal/message/metadata/abstract-message.js";
import { clearMetadataCache } from "../internal/message/metadata/registry.js";
import type { IAmphora } from "@lindorm/amphora";
import { validateEncryptedMessages } from "../internal/utils/validate-encrypted-messages.js";
import { IrisSession } from "./IrisSession.js";

export class IrisSource implements IIrisSource {
  private _driver: IIrisDriver | undefined;
  private readonly _options: IrisSourceOptions;
  private readonly _amphora: IAmphora | undefined;
  private _delayManager: DelayManager | undefined;
  private _deadLetterManager: DeadLetterManager | undefined;
  private readonly logger: ILogger;
  private readonly context: unknown;
  private readonly _messages: Array<Constructor<IMessage>>;
  private readonly _pendingMessagePaths: Array<MessageScannerInput[number]>;
  private readonly _driverType: IrisDriverType;
  private _subscribersRef: { current: Array<IMessageSubscriber> };
  private _connectingPromise: Promise<void> | null = null;
  private _disconnectingPromise: Promise<void> | null = null;
  private _settingUpPromise: Promise<void> | null = null;
  private isSetUp = false;

  public constructor(options: IrisSourceOptions) {
    this._options = options;
    this._amphora = options.amphora;
    this.logger = options.logger.child(["IrisSource"]);
    this.context = options.context;
    // Pre-loaded classes go straight into _messages; string paths are deferred
    // to setup() since scanner.import() is async.
    this._messages = (options.messages ?? []).filter(
      (a): a is Constructor<IMessage> => !isString(a) && (a as any)?.prototype != null,
    );
    this._pendingMessagePaths = (options.messages ?? []).filter((a) => isString(a));
    this._driverType = options.driver;
    this._subscribersRef = { current: [] };

    switch (options.driver) {
      case "memory":
      case "redis":
        break;

      case "rabbit": {
        if (!options.url)
          throw new IrisSourceError('Rabbit driver requires a "url" option');
        break;
      }

      case "kafka": {
        if (!options.brokers?.length)
          throw new IrisSourceError('Kafka driver requires a non-empty "brokers" array');
        break;
      }

      case "nats": {
        if (
          !options.servers ||
          (Array.isArray(options.servers) && options.servers.length === 0)
        )
          throw new IrisSourceError('NATS driver requires a "servers" option');
        break;
      }

      default: {
        const _exhaustive: never = options;
        throw new IrisNotSupportedError(
          `Unknown driver "${(_exhaustive as any).driver}"`,
        );
      }
    }
  }

  public get driver(): IrisDriverType {
    return this._driverType;
  }

  public get messages(): ReadonlyArray<Constructor<IMessage>> {
    return this._messages;
  }

  public async addMessages(input: MessageScannerInput): Promise<void> {
    if (this.isSetUp) {
      throw new IrisSourceError("Cannot add messages after setup() has been called");
    }
    const scanned = await MessageScanner.scan(input);
    for (const msg of scanned) {
      if (!this._messages.includes(msg)) {
        this._messages.push(msg);
      }
    }
  }

  public hasMessage(target: Constructor<IMessage>): boolean {
    return this._messages.includes(target);
  }

  public addSubscriber(subscriber: IMessageSubscriber): void {
    this._subscribersRef.current.push(subscriber);
  }

  public removeSubscriber(subscriber: IMessageSubscriber): void {
    this._subscribersRef.current = this._subscribersRef.current.filter(
      (s) => s !== subscriber,
    );
  }

  public session(options?: SessionOptions): IrisSession {
    const subscribersRef = { current: [...this._subscribersRef.current] };

    const clonedDriver = this._driver
      ? this._driver.cloneWithGetters(() => subscribersRef.current)
      : undefined;

    return new IrisSession({
      logger: options?.logger?.child(["IrisSource"]) ?? this.logger,
      context: options?.context ?? this.context,
      driver: clonedDriver!,
      driverType: this._driverType,
      messages: [...this._messages],
    });
  }

  public async connect(): Promise<void> {
    if (this._driver) return;
    if (this._connectingPromise) return this._connectingPromise;

    this._connectingPromise = this._doConnect();
    try {
      await this._connectingPromise;
    } finally {
      this._connectingPromise = null;
    }
  }

  public async disconnect(): Promise<void> {
    if (this._disconnectingPromise) return this._disconnectingPromise;

    this._disconnectingPromise = this._doDisconnect();
    try {
      await this._disconnectingPromise;
    } finally {
      this._disconnectingPromise = null;
    }
  }

  public async drain(timeout?: number): Promise<void> {
    if (!this._driver) return;
    await this._driver.drain(timeout);
  }

  public async ping(): Promise<boolean> {
    return this.requireDriver().ping();
  }

  public getConnectionState(): IrisConnectionState {
    if (!this._driver) return "disconnected";
    return this._driver.getConnectionState();
  }

  public on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this.requireDriver().on(event, listener);
  }

  public off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this.requireDriver().off(event, listener);
  }

  public once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this.requireDriver().once(event, listener);
  }

  public async setup(): Promise<void> {
    if (this.isSetUp) return;
    if (this._settingUpPromise) return this._settingUpPromise;

    this._settingUpPromise = this._doSetup();
    try {
      await this._settingUpPromise;
    } finally {
      this._settingUpPromise = null;
    }
  }

  public messageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M> {
    return this.requireDriver().createMessageBus(target);
  }

  public publisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return this.requireDriver().createPublisher(target);
  }

  public workerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M> {
    return this.requireDriver().createWorkerQueue(target);
  }

  public stream(): IIrisStreamProcessor {
    return this.requireDriver().createStreamProcessor();
  }

  public rpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res> {
    return this.requireDriver().createRpcClient(requestTarget, responseTarget);
  }

  public rpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res> {
    return this.requireDriver().createRpcServer(requestTarget, responseTarget);
  }

  // private

  private requireDriver(): IIrisDriver {
    if (!this._driver) {
      throw new IrisSourceError("Driver not connected. Call connect() first.");
    }
    return this._driver;
  }

  private async _createManagers(): Promise<void> {
    const { createDelayStore } =
      await import("../internal/delay/utils/create-delay-store.js");
    const { createDeadLetterStore } =
      await import("../internal/dead-letter/utils/create-dead-letter-store.js");
    const { DelayManager: DelayManagerClass } =
      await import("../internal/delay/DelayManager.js");
    const { DeadLetterManager: DeadLetterManagerClass } =
      await import("../internal/dead-letter/DeadLetterManager.js");

    const persistence = this._options.persistence;

    const delayStore = await createDelayStore(persistence?.delay);
    const deadLetterStore = await createDeadLetterStore(persistence?.deadLetter);

    this._delayManager = new DelayManagerClass({
      store: delayStore,
      logger: this.logger,
      pollIntervalMs: persistence?.delay?.pollIntervalMs,
    });

    this._deadLetterManager = new DeadLetterManagerClass({
      store: deadLetterStore,
      logger: this.logger,
    });
  }

  private async _doConnect(): Promise<void> {
    if (this._options.driver !== "rabbit") {
      await this._createManagers();
    }

    try {
      await this._doConnectDriver();
    } catch (error) {
      await this._closeManagers();
      throw error;
    }
  }

  private async _doConnectDriver(): Promise<void> {
    switch (this._options.driver) {
      case "memory": {
        const { MemoryDriver } =
          await import("../internal/drivers/memory/classes/MemoryDriver.js");
        const driver = new MemoryDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: (): Array<IMessageSubscriber> => this._subscribersRef.current,
          delayManager: this._delayManager,
          deadLetterManager: this._deadLetterManager,
        } as any);
        await driver.connect();
        this._driver = driver;
        break;
      }

      case "rabbit": {
        const { RabbitDriver } =
          await import("../internal/drivers/rabbit/classes/RabbitDriver.js");
        const rabbitOpts = this._options;
        const driver = new RabbitDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: (): Array<IMessageSubscriber> => this._subscribersRef.current,
          url: rabbitOpts.url,
          connection: rabbitOpts.connection,
          exchange: rabbitOpts.exchange,
          prefetch: rabbitOpts.prefetch,
        });
        await driver.connect();
        this._driver = driver;
        break;
      }

      case "kafka": {
        const { KafkaDriver } =
          await import("../internal/drivers/kafka/classes/KafkaDriver.js");
        const kafkaOpts = this._options;
        const driver = new KafkaDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: (): Array<IMessageSubscriber> => this._subscribersRef.current,
          brokers: kafkaOpts.brokers,
          connection: kafkaOpts.connection,
          prefix: kafkaOpts.prefix,
          prefetch: kafkaOpts.prefetch,
          sessionTimeoutMs: kafkaOpts.sessionTimeoutMs,
          acks: kafkaOpts.acks,
          delayManager: this._delayManager,
          deadLetterManager: this._deadLetterManager,
        });
        await driver.connect();
        this._driver = driver;
        break;
      }

      case "nats": {
        const { NatsDriver } =
          await import("../internal/drivers/nats/classes/NatsDriver.js");
        const natsOpts = this._options;
        const driver = new NatsDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: (): Array<IMessageSubscriber> => this._subscribersRef.current,
          servers: natsOpts.servers,
          connection: natsOpts.connection,
          prefix: natsOpts.prefix,
          prefetch: natsOpts.prefetch,
          delayManager: this._delayManager,
          deadLetterManager: this._deadLetterManager,
        });
        await driver.connect();
        this._driver = driver;
        break;
      }

      case "redis": {
        const { RedisDriver } =
          await import("../internal/drivers/redis/classes/RedisDriver.js");
        const redisOpts = this._options;
        const driver = new RedisDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: (): Array<IMessageSubscriber> => this._subscribersRef.current,
          url: redisOpts.url,
          connection: redisOpts.connection,
          prefix: redisOpts.prefix,
          prefetch: redisOpts.prefetch,
          blockMs: redisOpts.blockMs,
          maxStreamLength: redisOpts.maxStreamLength,
          delayManager: this._delayManager,
          deadLetterManager: this._deadLetterManager,
        });
        await driver.connect();
        this._driver = driver;
        break;
      }

      default: {
        const _exhaustive: never = this._options;
        throw new IrisNotSupportedError(`Unknown driver: ${(_exhaustive as any).driver}`);
      }
    }
  }

  private async _doDisconnect(): Promise<void> {
    if (this._connectingPromise) {
      try {
        await this._connectingPromise;
      } catch {
        /* connect failed, nothing to disconnect */
      }
    }
    if (!this._driver) return;

    try {
      await this._driver.disconnect();
    } finally {
      this._driver = undefined;
      this.isSetUp = false;
      this._connectingPromise = null;
      this._settingUpPromise = null;

      if (this._delayManager) {
        try {
          await this._delayManager.close();
        } catch (err) {
          this.logger.error("Failed to close delay manager", { error: err });
        }
        this._delayManager = undefined;
      }

      if (this._deadLetterManager) {
        try {
          await this._deadLetterManager.close();
        } catch (err) {
          this.logger.error("Failed to close dead letter manager", { error: err });
        }
        this._deadLetterManager = undefined;
      }
    }
  }

  private async _closeManagers(): Promise<void> {
    if (this._delayManager) {
      try {
        await this._delayManager.close();
      } catch (err) {
        this.logger.error("Failed to close delay manager during cleanup", { error: err });
      }
      this._delayManager = undefined;
    }

    if (this._deadLetterManager) {
      try {
        await this._deadLetterManager.close();
      } catch (err) {
        this.logger.error("Failed to close dead letter manager during cleanup", {
          error: err,
        });
      }
      this._deadLetterManager = undefined;
    }
  }

  private async _doSetup(): Promise<void> {
    clearMetadataCache();

    if (this._pendingMessagePaths.length) {
      const scanned = await MessageScanner.scan(this._pendingMessagePaths);
      for (const msg of scanned) {
        if (!this._messages.includes(msg)) {
          this._messages.push(msg);
        }
      }
      this._pendingMessagePaths.length = 0;
    }

    const concreteMessages = this._messages.filter(
      (target) => !isAbstractMessage(target),
    );

    validateEncryptedMessages(concreteMessages, this._amphora);

    await this.requireDriver().setup(concreteMessages);
    this.isSetUp = true;
  }
}

Object.defineProperty(IrisSource, Symbol.for("IrisSource"), { value: true });
