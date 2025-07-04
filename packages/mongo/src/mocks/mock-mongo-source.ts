import { IMongoSource } from "../interfaces";
import { createMockMongoBucket } from "./mock-mongo-bucket";
import { createMockMongoRepository } from "./mock-mongo-repository";

export const createMockMongoSource = (): IMongoSource => ({
  client: {} as any,
  database: {} as any,

  clone: jest.fn().mockImplementation(createMockMongoSource),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  collection: jest.fn(),

  addEntities: jest.fn(),
  repository: jest.fn().mockImplementation(createMockMongoRepository),

  addFiles: jest.fn(),
  bucket: jest.fn().mockImplementation(createMockMongoBucket),
});
