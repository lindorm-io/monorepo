import { DeepPartial } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";
import { IMnemosEntity } from "./MnemosEntity";

export interface IMnemosRepository<
  E extends IMnemosEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> {
  create(options?: O | E): E;

  count(predicate?: Predicate<E>): number;
  delete(predicate: Predicate<E>): void;
  deleteById(id: string): void;
  destroy(entity: E): void;
  destroyBulk(entities: Array<E>): void;
  exists(predicate: Predicate<E>): boolean;
  find(predicate?: Predicate<E>): Array<E>;
  findOne(predicate: Predicate<E>): E | null;
  findOneOrFail(predicate: Predicate<E>): E;
  findOneOrSave(predicate: Predicate<E>, options?: O): E;
  findOneById(id: string): E | null;
  findOneByIdOrFail(id: string): E;
  insert(entity: E): E;
  insertBulk(entities: Array<E>): Array<E>;
  save(entity: E): E;
  saveBulk(entities: Array<E>): Array<E>;
  update(entity: E): E;
  updateBulk(entities: Array<E>): Array<E>;
  ttl(predicate: Predicate<E>): number;
  ttlById(id: string): number;
}
