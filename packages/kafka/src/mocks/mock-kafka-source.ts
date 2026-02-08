import { IKafkaSource } from "../interfaces";
import { createMockKafkaMessageBus } from "./mock-kafka-message-bus";
import { createMockKafkaPublisher } from "./mock-kafka-publisher";

export const createMockKafkaSource = (): IKafkaSource => ({
  __instanceof: "KafkaSource",

  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockKafkaSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn(),
  setup: jest.fn(),

  addMessages: jest.fn(),
  hasMessage: jest.fn().mockReturnValue(true),

  messageBus: jest.fn().mockImplementation((target) => createMockKafkaMessageBus(target)),

  publisher: jest.fn().mockImplementation((target) => createMockKafkaPublisher(target)),
});
