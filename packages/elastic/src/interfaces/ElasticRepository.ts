import { QueryDslBoolQuery } from "@elastic/elasticsearch/lib/api/types";
import { IEntityBase } from "@lindorm/entity";
import { DeepPartial } from "@lindorm/types";

export interface IElasticRepository<
  E extends IEntityBase,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options: O | E): E;
  setup(): Promise<void>;

  count(query?: QueryDslBoolQuery): Promise<number>;
  delete(query: QueryDslBoolQuery): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(query: QueryDslBoolQuery): Promise<boolean>;
  find(query?: QueryDslBoolQuery): Promise<Array<E>>;
  findOne(query: QueryDslBoolQuery): Promise<E | null>;
  findOneById(id: string): Promise<E | null>;
  findOneByIdOrFail(id: string): Promise<E>;
  findOneOrFail(query: QueryDslBoolQuery): Promise<E>;
  findOneOrSave(query: QueryDslBoolQuery, options?: O): Promise<E>;
  insert(entity: E): Promise<E>;
  insertBulk(entities: Array<E>): Promise<Array<E>>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  softDelete(query: QueryDslBoolQuery): Promise<void>;
  softDeleteById(id: string): Promise<void>;
  softDestroy(entity: E): Promise<void>;
  softDestroyBulk(entities: Array<E>): Promise<void>;
  update(entity: E): Promise<E>;
  updateBulk(entities: Array<E>): Promise<Array<E>>;
  ttl(query: QueryDslBoolQuery): Promise<number>;
  ttlById(id: string): Promise<number>;
}
