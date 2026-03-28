import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisNotSupportedError } from "../errors/IrisNotSupportedError";
import { IrisSourceError } from "../errors/IrisSourceError";
import type { IIrisDriver } from "../interfaces/IrisDriver";
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
} from "../interfaces";
import type {
  CloneOptions,
  IrisConnectionState,
  IrisDriverType,
  IrisSourceOptions,
  MessageScannerInput,
} from "../types";
import type { DeadLetterManager } from "#internal/dead-letter/DeadLetterManager";
import type { DelayManager } from "#internal/delay/DelayManager";
import { MessageScanner } from "#internal/message/classes/MessageScanner";
import { isAbstractMessage } from "#internal/message/metadata/abstract-message";
import { clearMetadataCache } from "#internal/message/metadata/registry";
import type { IAmphora } from "@lindorm/amphora";
import type { IrisSourceInit } from "#internal/types";
import { validateEncryptedMessages } from "#internal/utils/validate-encrypted-messages";

export class IrisSource implements IIrisSource {
  private _driver: IIrisDriver | undefined;
  private readonly _options: IrisSourceOptions;
  private readonly _amphora: IAmphora | undefined;
  private _delayManager: DelayManager | undefined;
  private _deadLetterManager: DeadLetterManager | undefined;
  private readonly logger: ILogger;
  private readonly context: unknown;
  private readonly _messages: Array<Constructor<IMessage>>;
  private readonly _driverType: IrisDriverType;
  private _subscribersRef: { current: Array<IMessageSubscriber> };
  private _connectingPromise: Promise<void> | null = null;
  private _disconnectingPromise: Promise<void> | null = null;
  private _settingUpPromise: Promise<void> | null = null;
  private isSetUp = false;
  private _isClone = false;

  private static fromFields(fields: IrisSourceInit): IrisSource {
    return Object.assign(Object.create(IrisSource.prototype) as IrisSource, fields);
  }

  public constructor(options: IrisSourceOptions) {
    this._options = options;
    this._amphora = options.amphora;
    this.logger = options.logger.child(["IrisSource"]);
    this.context = options.context;
    this._messages = options.messages ? MessageScanner.scan(options.messages) : [];
    this._driverType = options.driver;
    this._subscribersRef = { current: [] };

    switch (options.driver) {
      case "memory":
      case "redis":
        break;

      case "rabbit": {
        const opts = options as IrisRabbitOptions;
        if (!opts.url) throw new IrisSourceError('Rabbit driver requires a "url" option');
        break;
      }

      case "kafka": {
        const opts = options as IrisKafkaOptions;
        if (!opts.brokers?.length)
          throw new IrisSourceError('Kafka driver requires a non-empty "brokers" array');
        break;
      }

      case "nats": {
        const opts = options as IrisNatsOptions;
        if (!opts.servers || (Array.isArray(opts.servers) && opts.servers.length === 0))
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

  public addMessages(input: MessageScannerInput): void {
    if (this.isSetUp) {
      throw new IrisSourceError("Cannot add messages after setup() has been called");
    }
    const scanned = MessageScanner.scan(input);
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

  public clone(options?: CloneOptions): IIrisSource {
    const subscribersRef = { current: [...this._subscribersRef.current] };

    return IrisSource.fromFields({
      logger: options?.logger?.child(["IrisSource"]) ?? this.logger,
      context: options?.context ?? this.context,
      _messages: [...this._messages],
      _amphora: this._amphora,
      _delayManager: this._delayManager,
      _deadLetterManager: this._deadLetterManager,
      _driverType: this._driverType,
      _subscribersRef: subscribersRef,
      _connectingPromise: null,
      _disconnectingPromise: null,
      _settingUpPromise: null,
      isSetUp: this.isSetUp,
      _isClone: true,
      _options: this._options,
      _driver: this._driver
        ? this._driver.cloneWithGetters(() => subscribersRef.current)
        : undefined,
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

  public onConnectionStateChange(callback: (state: IrisConnectionState) => void): void {
    const driver = this.requireDriver();
    if (driver.onConnectionStateChange) {
      driver.onConnectionStateChange(callback);
    }
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
    const { createDelayStore } = await import("#internal/delay/utils/create-delay-store");
    const { createDeadLetterStore } =
      await import("#internal/dead-letter/utils/create-dead-letter-store");
    const { DelayManager: DelayManagerClass } =
      await import("#internal/delay/DelayManager");
    const { DeadLetterManager: DeadLetterManagerClass } =
      await import("#internal/dead-letter/DeadLetterManager");

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
          await import("#internal/drivers/memory/classes/MemoryDriver");
        const driver = new MemoryDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: () => this._subscribersRef.current,
          delayManager: this._delayManager,
          deadLetterManager: this._deadLetterManager,
        } as any);
        await driver.connect();
        this._driver = driver;
        break;
      }

      case "rabbit": {
        const { RabbitDriver } =
          await import("#internal/drivers/rabbit/classes/RabbitDriver");
        const rabbitOpts = this._options;
        const driver = new RabbitDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: () => this._subscribersRef.current,
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
          await import("#internal/drivers/kafka/classes/KafkaDriver");
        const kafkaOpts = this._options;
        const driver = new KafkaDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: () => this._subscribersRef.current,
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
        const { NatsDriver } = await import("#internal/drivers/nats/classes/NatsDriver");
        const natsOpts = this._options;
        const driver = new NatsDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: () => this._subscribersRef.current,
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
          await import("#internal/drivers/redis/classes/RedisDriver");
        const redisOpts = this._options;
        const driver = new RedisDriver({
          logger: this.logger,
          context: this.context,
          amphora: this._amphora,
          getSubscribers: () => this._subscribersRef.current,
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

    if (this._isClone) {
      this._driver = undefined;
      this.isSetUp = false;
      this._connectingPromise = null;
      this._settingUpPromise = null;
      return;
    }

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

    const concreteMessages = this._messages.filter(
      (target) => !isAbstractMessage(target),
    );

    validateEncryptedMessages(concreteMessages, this._amphora);

    await this.requireDriver().setup(concreteMessages);
    this.isSetUp = true;
  }
}

Object.defineProperty(IrisSource, Symbol.for("IrisSource"), { value: true });
