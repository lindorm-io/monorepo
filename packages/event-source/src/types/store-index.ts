import { Attributes } from "./generic";

export interface StoreIndex<TFields extends Attributes = Attributes> {
  fields: Array<Partial<keyof TFields>>;
  name: string;
  unique: boolean;
}

export type StoreIndexes<TFields extends Attributes = Attributes> = Array<StoreIndex<TFields>>;
