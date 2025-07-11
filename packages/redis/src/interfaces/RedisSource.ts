import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { IMessage, MessageScannerInput } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import {
  CloneRedisSourceOptions,
  RedisSourceMessageBusOptions,
  RedisSourceRepositoryOptions,
} from "../types";
import { IRedisMessageBus } from "./RedisMessageBus";
import { IRedisRepository } from "./RedisRepository";

export interface IRedisSource {
  name: "RedisSource";

  client: Redis;

  clone(options?: CloneRedisSourceOptions): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  repository<E extends IEntity>(
    Entity: Constructor<E>,
    options?: RedisSourceRepositoryOptions,
  ): IRedisRepository<E>;

  addMessages(messages: MessageScannerInput): void;
  messageBus<M extends IMessage>(
    Message: Constructor<M>,
    options?: RedisSourceMessageBusOptions,
  ): IRedisMessageBus<M>;
}
