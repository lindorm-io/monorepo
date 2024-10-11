import { DeepPartial, Dict } from "@lindorm/types";
import { Predicate, Predicated, remove } from "@lindorm/utils";
import { MnemosCollectionError } from "../errors";
import { IMnemosCollection } from "../interfaces";
import { MnemosCollectionOptions, MnemosConstraint } from "../types";

export class MnemosCollection<T extends Dict> implements IMnemosCollection<T> {
  private readonly constraints: Array<MnemosConstraint<T>>;
  private state: Array<any>;

  public constructor(options: MnemosCollectionOptions<T>) {
    this.constraints = options.constraints ?? [];
    this.state = [];
  }

  // public

  public delete(predicate: Predicate<T>): void {
    this.state = Predicated.remove(this.state, predicate);
  }

  public find(predicate: Predicate<T> = {}): T | undefined {
    return Predicated.find<T>(this.state, predicate);
  }

  public filter(predicate: Predicate<T> = {}): Array<T> {
    return Predicated.filter<T>(this.state, predicate);
  }

  public insertOne(attributes: T): void {
    this.validate(attributes);
    this.state.push(attributes);
  }

  public insertMany(attributes: Array<T>): void {
    for (const item of attributes) {
      this.validate(item);
      this.validate(item, remove(attributes, item));
    }
    this.state = this.state.concat(attributes);
  }

  public update(predicate: Predicate<T>, attributes: DeepPartial<T>): void {
    if (!Object.keys(attributes).length) {
      throw new MnemosCollectionError("No attributes provided", {
        debug: { predicate },
      });
    }
    if (!Predicated.find<T>(this.state, predicate)) {
      throw new MnemosCollectionError("Record not found", {
        debug: { predicate },
      });
    }
    this.state = this.state.map((item) =>
      Predicated.match(item, predicate) ? { ...item, ...attributes } : item,
    );
  }

  // private

  private validate(attributes: T, state: Array<any> = this.state): void {
    if (!Object.keys(attributes).length) {
      throw new MnemosCollectionError("No attributes provided", {
        debug: { attributes },
      });
    }

    for (const constraint of this.constraints) {
      const predicate: Predicate<T> = {};

      for (const key of constraint.unique) {
        if (constraint.nullable?.includes(key)) {
          predicate[key] = {
            $and: [{ $eq: attributes[key] }, { $neq: null }],
          } as Predicate<T>[keyof T];
        } else {
          predicate[key] = attributes[key];
        }
      }

      if (!Predicated.find<T>(state, predicate)) continue;

      throw new MnemosCollectionError("Duplicate record", {
        debug: { attributes, constraint },
      });
    }
  }
}
