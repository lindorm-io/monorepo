import { IEntity } from "@lindorm/entity";
import { DeepPartial, Predicate } from "@lindorm/types";
import { FindCursor } from "mongodb";
import { CountDocumentsOptions, DeleteOptions, FindOptions } from "../types";

export interface IMongoRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options?: O | E): E;
  copy(entity: E): E;
  validate(entity: E): void;
  setup(): Promise<void>;

  clone(entity: E): Promise<E>;
  cloneBulk(entities: Array<E>): Promise<Array<E>>;
  count(criteria?: Predicate<E>, options?: CountDocumentsOptions<E>): Promise<number>;
  cursor(criteria?: Predicate<E>, options?: FindOptions<E>): FindCursor<DeepPartial<E>>;
  delete(criteria: Predicate<E>, options?: DeleteOptions<E>): Promise<void>;
  deleteExpired(): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(criteria: Predicate<E>, options?: FindOptions<E>): Promise<boolean>;
  find(criteria?: Predicate<E>, options?: FindOptions<E>): Promise<Array<E>>;
  findOne(criteria: Predicate<E>, options?: FindOptions<E>): Promise<E | null>;
  findOneOrFail(criteria: Predicate<E>, options?: FindOptions<E>): Promise<E>;
  findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E>;
  insert(entity: O | E): Promise<E>;
  insertBulk(entities: Array<O | E>): Promise<Array<E>>;
  save(entity: O | E): Promise<E>;
  saveBulk(entities: Array<O | E>): Promise<Array<E>>;
  softDelete(criteria: Predicate<E>, options?: DeleteOptions<E>): Promise<void>;
  softDestroy(entity: E): Promise<void>;
  softDestroyBulk(entities: Array<E>): Promise<void>;
  ttl(criteria: Predicate<E>, options?: FindOptions<E>): Promise<number>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
  updateMany(criteria: Predicate<E>, update: DeepPartial<E>): Promise<void>;
  versions(criteria: Predicate<E>): Promise<Array<E>>;
}
