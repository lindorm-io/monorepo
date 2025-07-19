import { IEntity } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";
import { CountDocumentsOptions, DeleteOptions, Filter, FindCursor } from "mongodb";
import { FindOptions } from "../types";

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
  count(criteria?: Filter<E>, options?: CountDocumentsOptions): Promise<number>;
  cursor(criteria?: Filter<E>, options?: FindOptions<E>): FindCursor<DeepPartial<E>>;
  delete(criteria: Filter<E>, options?: DeleteOptions): Promise<void>;
  deleteExpired(): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(criteria: Filter<E>, options?: FindOptions<E>): Promise<boolean>;
  find(criteria?: Filter<E>, options?: FindOptions<E>): Promise<Array<E>>;
  findOne(criteria: Filter<E>, options?: FindOptions<E>): Promise<E | null>;
  findOneOrFail(criteria: Filter<E>, options?: FindOptions<E>): Promise<E>;
  findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E>;
  insert(entity: O | E): Promise<E>;
  insertBulk(entities: Array<O | E>): Promise<Array<E>>;
  save(entity: O | E): Promise<E>;
  saveBulk(entities: Array<O | E>): Promise<Array<E>>;
  softDelete(criteria: Filter<E>, options?: DeleteOptions): Promise<void>;
  softDestroy(entity: E): Promise<void>;
  softDestroyBulk(entities: Array<E>): Promise<void>;
  ttl(criteria: Filter<E>): Promise<number>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
  updateMany(criteria: Filter<E>, update: DeepPartial<E>): Promise<void>;
  versions(criteria: Filter<E>): Promise<Array<E>>;
}
