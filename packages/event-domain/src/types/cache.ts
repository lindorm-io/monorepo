import { DomainEvent } from "../message";
import { StandardIdentifier } from "./standard-identifier";
import { State } from "./generic";

export type CacheIdentifier = StandardIdentifier;

export interface CacheData<S extends State = State> extends CacheIdentifier {
  causationList: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: S;
}

export interface CacheEmitData<S extends State = State> extends StandardIdentifier {
  destroyed: boolean;
  revision: number;
  state: S;
}

export interface CacheOptions<S extends State = State> extends CacheIdentifier {
  causationList?: Array<string>;
  destroyed?: boolean;
  meta?: Record<string, any>;
  revision?: number;
  state?: S;
}

export interface ICache<S extends State = State> extends CacheData<S> {
  addField(causation: DomainEvent, path: string, value: any): void;
  destroy(): void;
  removeFieldWhereEqual(causation: DomainEvent, path: string, value: any): void;
  removeFieldWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: any): void;
  toJSON(): CacheData;
}
