import { EntityMetadata } from "@lindorm/entity";
import { DeepPartial, Dict } from "@lindorm/types";
import { Predicate, Predicated, remove } from "@lindorm/utils";
import { MnemosCollectionError } from "../errors";
import { IMnemosCollection } from "../interfaces";
import { MnemosCollectionOptions } from "../types";

export class MnemosCollection<T extends Dict> implements IMnemosCollection<T> {
  private readonly metadata: EntityMetadata | null;
  private state: Array<any>;

  public constructor(options: MnemosCollectionOptions) {
    this.metadata = options.metadata ?? null;
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

  public insertOne(attributes: T): T {
    this.validate(attributes);
    this.state.push(attributes);
    return attributes;
  }

  public insertMany(attributes: Array<T>): Array<T> {
    for (const item of attributes) {
      this.validate(item);
      this.validate(item, remove(attributes, item));
    }
    this.state = this.state.concat(attributes);
    return attributes;
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

    if (!this.metadata) return;

    for (const index of this.metadata.indexes) {
      const predicate: Predicate<any> = {};

      for (const k of index.keys) {
        const attribute = this.metadata.columns.find((a) => a.key === k.key);
        const nullable = attribute?.nullable ?? false;

        if (nullable) {
          predicate[k.key] = {
            $and: [{ $eq: attributes[k.key] }, { $neq: null }],
          };
        } else {
          predicate[k.key] = attributes[k.key];
        }
      }

      if (!Predicated.find(state, predicate)) continue;

      throw new MnemosCollectionError("Duplicate record", {
        code: "duplicate_record",
        debug: { attributes, unique: index },
      });
    }
  }
}
