import { Constructor } from "@lindorm/types";
import { IMongoEntity, IMongoFile, IMongoSource } from "../interfaces";
import { createMockMongoBucket } from "./mock-mongo-bucket";
import { createMockMongoRepository } from "./mock-mongo-repository";

export const createMockMongoSource = (): IMongoSource => ({
  client: {} as any,
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  bucket: jest
    .fn()
    .mockImplementation((File: Constructor<IMongoFile>) =>
      createMockMongoBucket((args) => new File(args)),
    ),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IMongoEntity>) =>
      createMockMongoRepository((args) => new Entity(args)),
    ),
});
