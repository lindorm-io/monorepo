import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IKafkaSource } from "../interfaces";
import { createMockKafkaMessageBus } from "./mock-kafka-message-bus";

export const createMockKafkaSource = (): IKafkaSource => ({
  name: "KafkaSource",
  client: {} as any,
  addMessages: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockKafkaSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  messageBus: jest
    .fn()
    .mockImplementation((target: Constructor<IMessage>) =>
      createMockKafkaMessageBus(target),
    ),
});
