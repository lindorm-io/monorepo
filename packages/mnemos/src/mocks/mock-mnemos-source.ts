import { IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { IMnemosSource } from "../interfaces";
import { createMockMnemosRepository } from "./mock-mnemos-repository";

export const createMockMnemosSource = (): IMnemosSource => ({
  client: {} as any,
  addEntities: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockMnemosSource()),
  repository: jest.fn().mockImplementation((Entity: Constructor<IEntity>) =>
    createMockMnemosRepository((args) => {
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
