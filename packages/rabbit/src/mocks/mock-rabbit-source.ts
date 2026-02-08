import { IRabbitSource } from "../interfaces";
import { createMockRabbitMessageBus } from "./mock-rabbit-message-bus";
import { createMockRabbitPublisher } from "./mock-rabbit-publisher";

export const createMockRabbitSource = (): IRabbitSource => ({
  __instanceof: "RabbitSource",

  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockRabbitSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn(),
  setup: jest.fn(),

  addMessages: jest.fn(),
  hasMessage: jest.fn().mockReturnValue(true),

  messageBus: jest
    .fn()
    .mockImplementation((target) => createMockRabbitMessageBus(target)),

  publisher: jest.fn().mockImplementation((target) => createMockRabbitPublisher(target)),
});
