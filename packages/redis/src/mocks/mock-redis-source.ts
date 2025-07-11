import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IRedisSource } from "../interfaces";
import { createMockRedisMessageBus } from "./mock-redis-message-bus";
import { createMockRedisRepository } from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  name: "RedisSource",
  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockRedisSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  addEntities: jest.fn(),
  repository: jest.fn().mockImplementation(createMockRedisRepository),

  addMessages: jest.fn(),
  messageBus: jest
    .fn()
    .mockImplementation((Message: Constructor<IMessage>) =>
      createMockRedisMessageBus(Message),
    ),
});
