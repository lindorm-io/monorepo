import {
  EntityScanner,
  EntityScannerInput,
  globalEntityMetadata,
  IEntity,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import {
  globalMessageMetadata,
  IMessage,
  IMessageSubscriptions,
  MessageScanner,
  MessageScannerInput,
  MessageSubscriptions,
} from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { RedisSourceError } from "../errors";
import { IRedisPublisher, IRedisRepository, IRedisSource } from "../interfaces";
import { IRedisMessageBus } from "../interfaces/RedisMessageBus";
import { RedisSourceOptions, WithLoggerOptions } from "../types";
import { FromClone } from "../types/private";
import { RedisDelayService } from "./private";
import { RedisMessageBus } from "./RedisMessageBus";
import { RedisPublisher } from "./RedisPublisher";
import { RedisRepository } from "./RedisRepository";

export class RedisSource implements IRedisSource {
  public readonly __instanceof = "RedisSource";

  private readonly cache: Map<Constructor<IMessage>, IRedisMessageBus<IMessage>>;
  private readonly delayService: RedisDelayService;
  private readonly entities: Array<Constructor<IEntity>>;
  private readonly logger: ILogger;
  private readonly messages: Array<Constructor<IMessage>>;
  private readonly namespace: string | undefined;
  private readonly subscriptions: IMessageSubscriptions;

  public readonly client: Redis;

  public constructor(options: RedisSourceOptions);
  public constructor(options: FromClone);
  public constructor(options: RedisSourceOptions | FromClone) {
    this.logger = options.logger.child(["RedisSource"]);
    this.namespace = options.namespace;

    if ("_mode" in options && options._mode === "from_clone") {
      this.cache = options.cache;
      this.delayService = options.delayService;
      this.client = options.client;
      this.entities = options.entities;
      this.messages = options.messages;
      this.subscriptions = options.subscriptions;
    } else {
      const opts = options as RedisSourceOptions;

      this.cache = new Map();
      this.client = opts.config ? new Redis(opts.url, opts.config) : new Redis(opts.url);
      this.entities = opts.entities ? EntityScanner.scan<IEntity>(opts.entities) : [];
      this.messages = opts.messages ? MessageScanner.scan<IMessage>(opts.messages) : [];

      this.delayService = new RedisDelayService({
        client: this.client,
        logger: this.logger,
      });
      this.subscriptions = new MessageSubscriptions();
    }
  }

  // public

  public clone(options: WithLoggerOptions = {}): IRedisSource {
    return new RedisSource({
      _mode: "from_clone",
      cache: this.cache,
      client: this.client,
      delayService: this.delayService,
      entities: this.entities,
      logger: options.logger ?? this.logger,
      messages: this.messages,
      namespace: this.namespace,
      subscriptions: this.subscriptions,
    });
  }

  public async connect(): Promise<void> {
    if (this.client.status === "ready") return;
    if (this.client.status === "connecting") return;
    if (this.client.status === "reconnecting") return;

    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    this.delayService.stop();

    for (const Message of this.messages) {
      await this.messageBus(Message).unsubscribeAll();
    }

    await this.client.quit();
  }

  public async setup(): Promise<void> {
    await this.connect();

    for (const Entity of this.entities) {
      await this.repository(Entity).setup();
    }

    if (this.messages.length) {
      this.delayService.start();
    }
  }

  public addEntities(entities: EntityScannerInput): void {
    this.entities.push(
      ...EntityScanner.scan(entities).filter((Entity) => !this.entities.includes(Entity)),
    );
  }

  public addMessages(messages: MessageScannerInput): void {
    this.messages.push(
      ...MessageScanner.scan(messages).filter(
        (Message) => !this.messages.includes(Message),
      ),
    );
  }

  public hasEntity(target: Constructor<IEntity>): boolean {
    return this.entities.some((Entity) => Entity === target);
  }

  public hasMessage(target: Constructor<IMessage>): boolean {
    return this.messages.some((Message) => Message === target);
  }

  public messageBus<M extends IMessage>(
    target: Constructor<M>,
    options: WithLoggerOptions = {},
  ): IRedisMessageBus<M> {
    if (!this.cache.has(target)) {
      this.messageExists(target);

      this.cache.set(
        target,
        new RedisMessageBus({
          client: this.client,
          logger: options.logger ?? this.logger,
          subscriptions: this.subscriptions,
          target: target,
        }),
      );
    }

    return this.cache.get(target) as IRedisMessageBus<M>;
  }

  public publisher<M extends IMessage>(
    target: Constructor<M>,
    options: WithLoggerOptions = {},
  ): IRedisPublisher<M> {
    this.messageExists(target);

    return new RedisPublisher({
      target: target,
      client: this.client,
      logger: options.logger ?? this.logger,
    });
  }

  public repository<E extends IEntity>(
    target: Constructor<E>,
    options: WithLoggerOptions = {},
  ): IRedisRepository<E> {
    this.entityExists(target);

    return new RedisRepository({
      target: target,
      client: this.client,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  // private

  private entityExists<E extends IEntity>(target: Constructor<E>): void {
    const config = this.entities.find((e) => e === target);

    if (!config) {
      throw new RedisSourceError("Entity not found in entities list", {
        debug: { target },
      });
    }

    const metadata = globalEntityMetadata.get(target);

    if (metadata.entity.decorator !== "Entity") {
      throw new RedisSourceError(`Entity is not decorated with @Entity`, {
        debug: { target },
      });
    }
  }

  private messageExists<M extends IMessage>(target: Constructor<M>): void {
    const config = this.messages.find((m) => m === target);

    if (!config) {
      throw new RedisSourceError("Message not found in messages list", {
        debug: { target },
      });
    }

    const metadata = globalMessageMetadata.get(target);

    if (metadata.message.decorator !== "Message") {
      throw new RedisSourceError(`Message is not decorated with @Message`, {
        debug: { target },
      });
    }
  }
}
