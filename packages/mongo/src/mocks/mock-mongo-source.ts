import { IEntityBase } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { IMongoFile, IMongoSource } from "../interfaces";
import { createMockMongoBucket, createMockMongoFileCallback } from "./mock-mongo-bucket";
import {
  createMockMongoEntityCallback,
  createMockMongoRepository,
} from "./mock-mongo-repository";

export const createMockMongoSource = (): IMongoSource => ({
  client: {} as any,
  database: {} as any,
  addEntities: jest.fn(),
  addFiles: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockMongoSource()),
  collection: jest.fn().mockImplementation(() => ({}) as any),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  bucket: jest
    .fn()
    .mockImplementation((File: Constructor<IMongoFile>) =>
      createMockMongoBucket(createMockMongoFileCallback(File)),
    ),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IEntityBase>) =>
      createMockMongoRepository(createMockMongoEntityCallback(Entity)),
    ),
});
