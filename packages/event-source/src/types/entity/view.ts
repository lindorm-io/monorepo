import { DomainEvent } from "../../message";
import { StandardIdentifier } from "../standard-identifier";
import { State } from "../generic";

export type ViewIdentifier = StandardIdentifier;

export interface ViewData<S extends State = State> extends ViewIdentifier {
  destroyed: boolean;
  hash: string;
  meta: Record<string, any>;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface ViewOptions<S extends State = State> extends ViewIdentifier {
  destroyed?: boolean;
  hash?: string;
  meta?: Record<string, any>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;
}

export interface IView<S extends State = State> extends ViewData<S> {
  addListItem(causation: DomainEvent, path: string, value: any): void;
  destroy(): void;
  removeListItemWhereEqual(causation: DomainEvent, path: string, value: any): void;
  removeListItemWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: any): void;
  toJSON(): ViewData;
}
