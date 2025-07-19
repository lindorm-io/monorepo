import { IEntity } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";

export interface IRedisRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options: O | E): E;
  copy(entity: E): E;
  validate(entity: E): void;
  setup(): Promise<void>;

  clone(entity: E): Promise<E>;
  cloneBulk(entities: Array<E>): Promise<Array<E>>;
  count(predicate?: Predicate<E>): Promise<number>;
  delete(predicate: Predicate<E>): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(predicate: Predicate<E>): Promise<boolean>;
  find(predicate?: Predicate<E>): Promise<Array<E>>;
  findOne(predicate: Predicate<E>): Promise<E | null>;
  findOneOrFail(predicate: Predicate<E>): Promise<E>;
  findOneOrSave(predicate: Predicate<E>, options?: O): Promise<E>;
  insert(entity: O | E): Promise<E>;
  insertBulk(entities: Array<O | E>): Promise<Array<E>>;
  save(entity: O | E): Promise<E>;
  saveBulk(entities: Array<O | E>): Promise<Array<E>>;
  ttl(predicate: Predicate<E>): Promise<number>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
}
