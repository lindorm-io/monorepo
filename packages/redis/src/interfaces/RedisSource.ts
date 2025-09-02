import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { WithLoggerOptions } from "../types";
import { IRedisMessageBus } from "./RedisMessageBus";
import { IRedisPublisher } from "./RedisPublisher";
import { IRedisRepository } from "./RedisRepository";

export interface IRedisSource {
  __instanceof: "RedisSource";

  client: Redis;

  clone(options?: WithLoggerOptions): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  addMessages(messages: MessageScannerInput): void;

  hasEntity(target: Constructor<IEntity>): boolean;
  hasMessage(target: Constructor<IMessage>): boolean;

  messageBus<M extends IMessage>(
    target: Constructor<M>,
    options?: WithLoggerOptions,
  ): IRedisMessageBus<M>;

  publisher<M extends IMessage>(
    target: Constructor<M>,
    options?: WithLoggerOptions,
  ): IRedisPublisher<M>;

  repository<E extends IEntity>(
    target: Constructor<E>,
    options?: WithLoggerOptions,
  ): IRedisRepository<E>;
}
