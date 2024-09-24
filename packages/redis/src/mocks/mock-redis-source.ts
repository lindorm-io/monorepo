import { Constructor } from "@lindorm/types";
import { IRedisEntity, IRedisSource } from "../interfaces";
import { createMockRedisRepository } from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  client: {} as any,
  clone: jest.fn().mockImplementation(() => createMockRedisSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  repository: jest.fn().mockImplementation((Entity: Constructor<IRedisEntity>) =>
    createMockRedisRepository((args) => {
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
