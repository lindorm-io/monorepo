import { Constructor } from "@lindorm/types";
import { IRabbitMessage, IRabbitSource } from "../interfaces";
import { createMockRabbitMessageBus } from "./mock-rabbit-message-bus";

export const createMockRabbitSource = (): IRabbitSource => ({
  client: {} as any,
  addMessages: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockRabbitSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  messageBus: jest
    .fn()
    .mockImplementation((Message: Constructor<IRabbitMessage>) =>
      createMockRabbitMessageBus(Message),
    ),
});
