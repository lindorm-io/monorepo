import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";

export interface IRedisRepository<
  E extends IEntityBase,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options: O | E): E;

  count(predicate?: Predicate<E>): Promise<number>;
  delete(predicate: Predicate<E>): Promise<void>;
  deleteById(id: string): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(predicate: Predicate<E>): Promise<boolean>;
  find(predicate?: Predicate<E>): Promise<Array<E>>;
  findOne(predicate: Predicate<E>): Promise<E | null>;
  findOneOrFail(predicate: Predicate<E>): Promise<E>;
  findOneOrSave(predicate: Predicate<E>, options?: O): Promise<E>;
  findOneById(id: string): Promise<E | null>;
  findOneByIdOrFail(id: string): Promise<E>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  ttl(predicate: Predicate<E>): Promise<number>;
  ttlById(id: string): Promise<number>;
}
