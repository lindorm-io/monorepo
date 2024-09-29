import { DeepPartial } from "@lindorm/types";
import { CountDocumentsOptions, DeleteOptions, Filter, FindOptions } from "mongodb";
import { IMongoEntity } from "./MongoEntity";

export interface IMongoRepository<
  E extends IMongoEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options?: O | E): E;

  count(criteria?: Filter<E>, options?: CountDocumentsOptions): Promise<number>;
  delete(criteria: Filter<E>, options?: DeleteOptions): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(criteria: Filter<E>, options?: FindOptions<E>): Promise<boolean>;
  find(criteria?: Filter<E>, options?: FindOptions<E>): Promise<Array<E>>;
  findOne(criteria: Filter<E>, options?: FindOptions<E>): Promise<E | null>;
  findOneOrFail(criteria: Filter<E>, options?: FindOptions<E>): Promise<E>;
  findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E>;
  findOneById(id: string): Promise<E | null>;
  findOneByIdOrFail(id: string): Promise<E>;
  insert(entity: E): Promise<E>;
  insertBulk(entities: Array<E>): Promise<Array<E>>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  softDelete(criteria: Filter<E>, options?: DeleteOptions): Promise<void>;
  softDeleteById(id: string): Promise<void>;
  softDestroy(entity: E): Promise<void>;
  softDestroyBulk(entities: Array<E>): Promise<void>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
  ttl(criteria: Filter<E>): Promise<number>;
  ttlById(id: string): Promise<number>;

  setup(): Promise<void>;
}
