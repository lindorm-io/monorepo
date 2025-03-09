import { QueryDslBoolQuery } from "@elastic/elasticsearch/lib/api/types";
import { IEntity } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export interface IElasticRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options?: O | E): E;
  copy(entity: E): E;
  validate(entity: E): void;
  setup(): Promise<void>;

  clone(entity: E): Promise<E>;
  cloneBulk(entities: Array<E>): Promise<Array<E>>;
  count(query?: QueryDslBoolQuery): Promise<number>;
  delete(query: QueryDslBoolQuery): Promise<void>;
  deleteExpired(): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(query: QueryDslBoolQuery): Promise<boolean>;
  find(query?: QueryDslBoolQuery): Promise<Array<E>>;
  findOne(query: QueryDslBoolQuery): Promise<E | null>;
  findOneOrFail(query: QueryDslBoolQuery): Promise<E>;
  findOneOrSave(query: QueryDslBoolQuery, options?: O): Promise<E>;
  insert(entity: E): Promise<E>;
  insertBulk(entities: Array<E>): Promise<Array<E>>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  softDelete(query: QueryDslBoolQuery): Promise<void>;
  softDestroy(entity: E): Promise<void>;
  softDestroyBulk(entities: Array<E>): Promise<void>;
  ttl(query: QueryDslBoolQuery): Promise<number>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
  updateMany(query: QueryDslBoolQuery, update: DeepPartial<E>): Promise<void>;
}
