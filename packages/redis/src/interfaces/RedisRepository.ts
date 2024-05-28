import { DeepPartial } from "@lindorm/types";
import { IRedisEntity } from "./RedisEntity";

export type Criteria<E> = DeepPartial<E>;

export interface IRedisRepository<E extends IRedisEntity> {
  count(criteria?: Criteria<E>): Promise<number>;
  create(partial: DeepPartial<E>): E;
  delete(criteria: Criteria<E>): Promise<void>;
  deleteById(id: string): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(criteria: Criteria<E>): Promise<boolean>;
  find(criteria?: Criteria<E>): Promise<Array<E>>;
  findOne(criteria: Criteria<E>): Promise<E | null>;
  findOneOrFail(criteria: Criteria<E>): Promise<E>;
  findOneOrSave(criteria: Criteria<E>): Promise<E>;
  findOneById(id: string): Promise<E | null>;
  findOneByIdOrFail(id: string): Promise<E>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  ttl(entity: E): Promise<number>;
  ttlById(id: string): Promise<number>;
}
