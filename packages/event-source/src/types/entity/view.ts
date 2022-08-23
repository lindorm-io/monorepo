import { DomainEvent } from "../../message";
import { StandardIdentifier } from "../standard-identifier";
import { State } from "../generic";

export type ViewIdentifier = StandardIdentifier;

export interface ViewData<TState extends State = State> extends ViewIdentifier {
  destroyed: boolean;
  hash: string;
  meta: Record<string, any>;
  processedCausationIds: Array<string>;
  revision: number;
  state: TState;
}

export interface ViewOptions<TState extends State = State> extends ViewIdentifier {
  destroyed?: boolean;
  hash?: string;
  meta?: Record<string, any>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: TState;
}

export interface IView<TState extends State = State> extends ViewData<TState> {
  addListItem(causation: DomainEvent, path: string, value: any): void;
  destroy(): void;
  removeListItemWhereEqual(causation: DomainEvent, path: string, value: any): void;
  removeListItemWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: any): void;
  toJSON(): ViewData;
}
