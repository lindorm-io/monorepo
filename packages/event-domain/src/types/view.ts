import { DomainEvent } from "../message";
import { StandardIdentifier } from "./standard-identifier";

export type ViewIdentifier = StandardIdentifier;

export interface ViewData<State extends Record<string, any> = Record<string, any>>
  extends ViewIdentifier {
  causationList: Array<string>;
  destroyed: boolean;
  meta: Record<string, any>;
  revision: number;
  state: State;
}

export interface ViewOptions<State extends Record<string, any> = Record<string, any>>
  extends ViewIdentifier {
  causationList?: Array<string>;
  destroyed?: boolean;
  meta?: Record<string, any>;
  revision?: number;
  state?: State;
}

export interface IView<State extends Record<string, any> = Record<string, any>>
  extends ViewData<State> {
  addField(causation: DomainEvent, path: string, value: any): void;
  destroy(): void;
  removeFieldWhereEqual(causation: DomainEvent, path: string, value: any): void;
  removeFieldWhereMatch(causation: DomainEvent, path: string, value: Record<string, any>): void;
  setState(causation: DomainEvent, path: string, value: any): void;
  toJSON(): ViewData;
}
