import { DeepPartial, Dict } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";

export interface IMnemosCollection<T extends Dict = Dict> {
  delete(criteria: Predicate<T>): void;
  find(criteria?: Predicate<T>): T | undefined;
  filter(criteria?: Predicate<T>): Array<T>;
  insertOne(attributes: T): T;
  insertMany(attributes: Array<T>): Array<T>;
  update(criteria: Predicate<T>, attributes: DeepPartial<T>): void;
}
