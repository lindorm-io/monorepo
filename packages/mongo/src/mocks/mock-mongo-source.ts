import { Constructor } from "@lindorm/types";
import { IMongoEntity, IMongoFile, IMongoSource } from "../interfaces";
import { createMockMongoBucket } from "./mock-mongo-bucket";
import { createMockMongoRepository } from "./mock-mongo-repository";

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
      createMockMongoBucket((args) => new File(args)),
    ),
  repository: jest.fn().mockImplementation((Entity: Constructor<IMongoEntity>) =>
    createMockMongoRepository((args) => {
      const entity = new Entity(args);

      entity.id = (args.id as string) ?? entity.id;
      entity.rev = (args.rev as number) ?? entity.rev;
      entity.seq = (args.seq as number) ?? entity.seq;
      entity.createdAt = (args.createdAt as Date) ?? entity.createdAt;
      entity.updatedAt = (args.updatedAt as Date) ?? entity.updatedAt;
      entity.deletedAt = (args.deletedAt as Date) ?? (entity.deletedAt as Date);
      entity.expiresAt = (args.expiresAt as Date) ?? (entity.expiresAt as Date);

      return entity;
    }),
  ),
});
