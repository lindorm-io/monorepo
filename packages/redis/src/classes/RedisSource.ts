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
import { IRedisRepository, IRedisSource } from "../interfaces";
import { IRedisMessageBus } from "../interfaces/RedisMessageBus";
import {
  CloneRedisSourceOptions,
  RedisSourceMessageBusOptions,
  RedisSourceOptions,
  RedisSourceRepositoryOptions,
} from "../types";
import { FromClone } from "../types/private";
import { RedisMessageBus } from "./RedisMessageBus";
import { RedisRepository } from "./RedisRepository";
import { DelayedMessageWorker } from "./private";

export class RedisSource implements IRedisSource {
  public readonly name = "RedisSource";

  private readonly delayedMessageWorker: DelayedMessageWorker;
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
      const opts = options as FromClone;

      this.delayedMessageWorker = opts.delayedMessageWorker;
      this.client = opts.client;
      this.entities = opts.entities;
      this.messages = opts.messages;
      this.subscriptions = opts.subscriptions;
    } else {
      const opts = options as RedisSourceOptions;

      this.client = opts.config ? new Redis(opts.url, opts.config) : new Redis(opts.url);
      this.entities = opts.entities ? EntityScanner.scan<IEntity>(opts.entities) : [];
      this.messages = opts.messages ? MessageScanner.scan<IMessage>(opts.messages) : [];

      this.delayedMessageWorker = new DelayedMessageWorker({
        client: this.client,
        logger: this.logger,
      });
      this.subscriptions = new MessageSubscriptions();
    }
  }

  // public

  public clone(options: CloneRedisSourceOptions = {}): IRedisSource {
    return new RedisSource({
      _mode: "from_clone",
      client: this.client,
      delayedMessageWorker: this.delayedMessageWorker,
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
    this.delayedMessageWorker.stop();

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
      this.delayedMessageWorker.start();
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

  public repository<E extends IEntity>(
    Entity: Constructor<E>,
    options: RedisSourceRepositoryOptions = {},
  ): IRedisRepository<E> {
    this.entityExists(Entity);

    return new RedisRepository({
      Entity,
      client: this.client,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
    });
  }

  public messageBus<M extends IMessage>(
    Message: Constructor<M>,
    options: RedisSourceMessageBusOptions = {},
  ): IRedisMessageBus<M> {
    this.messageExists(Message);

    return new RedisMessageBus({
      Message,
      client: this.client,
      logger: options.logger ?? this.logger,
      subscriptions: this.subscriptions,
    });
  }

  // private

  private entityExists<E extends IEntity>(Entity: Constructor<E>): void {
    const config = this.entities.find((e) => e === Entity);

    if (!config) {
      throw new RedisSourceError("Entity not found in entities list", {
        debug: { Entity },
      });
    }

    const metadata = globalEntityMetadata.get(Entity);

    if (metadata.entity.decorator !== "Entity") {
      throw new RedisSourceError(`Entity is not decorated with @Entity`, {
        debug: { Entity },
      });
    }
  }

  private messageExists<M extends IMessage>(Message: Constructor<M>): void {
    const config = this.messages.find((m) => m === Message);

    if (!config) {
      throw new RedisSourceError("Message not found in messages list", {
        debug: { Message },
      });
    }

    const metadata = globalMessageMetadata.get(Message);

    if (metadata.message.decorator !== "Message") {
      throw new RedisSourceError(`Message is not decorated with @Message`, {
        debug: { Message },
      });
    }
  }
}
