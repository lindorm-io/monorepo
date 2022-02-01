import { Optional } from "./utility";

export type EntityKeys = "id" | "created" | "updated" | "version";

export interface EntityAttributes {
  id: string;
  created: Date;
  updated: Date;
  version: number;
}

export type EntityOptions = Optional<EntityAttributes, EntityKeys>;

export interface ILindormEntity<Attributes extends EntityAttributes> extends EntityAttributes {
  schemaValidation(): Promise<void>;
  toJSON(): Attributes;
}
