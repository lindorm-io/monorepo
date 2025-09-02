import { IMongoSource } from "../interfaces";
import { createMockMongoBucket } from "./mock-mongo-bucket";
import { createMockMongoRepository } from "./mock-mongo-repository";

export const createMockMongoSource = (): IMongoSource => ({
  __instanceof: "MongoSource",

  client: {} as any,
  database: {} as any,

  clone: jest.fn().mockImplementation(createMockMongoSource),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  collection: jest.fn(),

  addEntities: jest.fn(),
  addFiles: jest.fn(),

  hasEntity: jest.fn().mockReturnValue(true),
  hasFile: jest.fn().mockReturnValue(true),

  repository: jest.fn().mockImplementation((target) => createMockMongoRepository(target)),
  bucket: jest.fn().mockImplementation((target) => createMockMongoBucket(target)),
});
