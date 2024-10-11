import { Dict } from "@lindorm/types";
import { IMnemosCache, IMnemosCollection } from "../interfaces";
import { MnemosCollectionOptions } from "../types";
import { MnemosCollection } from "./MnemosCollection";

export class MnemosCache implements IMnemosCache {
  private readonly collections: Dict<IMnemosCollection>;

  public constructor() {
    this.collections = {};
  }

  public collection<T extends Dict>(
    collection: string,
    options: MnemosCollectionOptions = {},
  ): IMnemosCollection<T> {
    if (!this.collections[collection]) {
      this.collections[collection] = new MnemosCollection<T>(options);
    }
    return this.collections[collection] as IMnemosCollection<T>;
  }
}
