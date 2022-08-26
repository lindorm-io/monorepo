import { StandardIdentifier } from "../standard-identifier";
import { State } from "../generic";
import { DomainEvent } from "../../message";

export type ViewIdentifier = StandardIdentifier;

export interface ViewData<TState extends State = State> extends ViewIdentifier {
  destroyed: boolean;
  hash: string;
  modified: Date;
  processedCausationIds: Array<string>;
  revision: number;
  state: TState;
}

export interface ViewOptions<TState extends State = State> extends ViewIdentifier {
  destroyed?: boolean;
  hash?: string;
  modified?: Date;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: TState;
}

export interface IView<TState extends State = State> extends ViewData<TState> {
  destroy(event: DomainEvent): void;
  mergeState(event: DomainEvent, data: Partial<TState>): void;
  setState(event: DomainEvent, data: Partial<TState>): void;
  toJSON(): ViewData;
}
