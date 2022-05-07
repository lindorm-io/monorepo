import { EntityAttributes, EntityOptions } from "../types";
import { randomUUID } from "crypto";

export abstract class EntityBase {
  public readonly id: string;
  public readonly created: Date;

  public revision: number;
  public updated: Date;
  public version: number;

  protected constructor(options: EntityOptions = {}) {
    this.id = options.id || randomUUID();
    this.created = options.created || new Date();
    this.revision = options.revision || 0;
    this.updated = options.updated || new Date();
    this.version = options.version || 0;
  }

  protected defaultJSON(): EntityAttributes {
    return {
      id: this.id,
      created: this.created,
      revision: this.revision,
      updated: this.updated,
      version: this.version,
    };
  }
}
