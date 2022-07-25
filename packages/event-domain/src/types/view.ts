import { DomainEvent } from "../message";
import { StandardIdentifier } from "./standard-identifier";
import { State } from "./generic";

export type ViewIdentifier = StandardIdentifier;

export interface ViewData<S extends State = State> extends ViewIdentifier {
  causationList: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: S;
}

export interface ViewOptions<S extends State = State> extends ViewIdentifier {
  causationList?: Array<string>;
  destroyed?: boolean;
  meta?: Record<string, any>;
  revision?: number;
  state?: S;
}

export interface IView<S extends State = State> extends ViewData<S> {
  addField(causation: DomainEvent, path: string, value: any): void;
  destroy(): void;
  removeFieldWhereEqual(causation: DomainEvent, path: string, value: any): void;
  removeFieldWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: any): void;
  toJSON(): ViewData;
}
