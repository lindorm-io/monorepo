import { DeepPartial } from "@lindorm/types";
import { IRedisEntity } from "./RedisEntity";

export type Criteria<E> = DeepPartial<E>;

export interface IRedisRepository<
  E extends IRedisEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options: O | E): E;

  count(criteria?: Criteria<E>): Promise<number>;
  delete(criteria: Criteria<E>): Promise<void>;
  deleteById(id: string): Promise<void>;
  destroy(entity: E): Promise<void>;
  destroyBulk(entities: Array<E>): Promise<void>;
  exists(criteria: Criteria<E>): Promise<boolean>;
  find(criteria?: Criteria<E>): Promise<Array<E>>;
  findOne(criteria: Criteria<E>): Promise<E | null>;
  findOneOrFail(criteria: Criteria<E>): Promise<E>;
  findOneOrSave(criteria: DeepPartial<E>, options?: O): Promise<E>;
  findOneById(id: string): Promise<E | null>;
  findOneByIdOrFail(id: string): Promise<E>;
  save(entity: E): Promise<E>;
  saveBulk(entities: Array<E>): Promise<Array<E>>;
  ttl(criteria: Criteria<E>): Promise<number>;
  ttlById(id: string): Promise<number>;
}
