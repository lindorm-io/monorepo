import { Constructor } from "@lindorm/types";
import { IElasticEntity, IElasticSource } from "../interfaces";
import { createMockElasticRepository } from "./mock-elastic-repository";

export const createMockElasticSource = (): IElasticSource => ({
  client: {} as any,
  addEntities: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockElasticSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  repository: jest.fn().mockImplementation((Entity: Constructor<IElasticEntity>) =>
    createMockElasticRepository((args) => {
      const entity = new Entity(args);

      entity.id = (args.id as string) ?? entity.id;
      entity.primaryTerm = (args.primaryTerm as number) ?? entity.primaryTerm;
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
