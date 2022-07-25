import { Command, DomainEvent } from "../message";
import { StandardIdentifier } from "./standard-identifier";
import { AggregateIdentifier } from "./aggregate";
import { State } from "./generic";

export type SagaIdentifier = StandardIdentifier;

export interface SagaData extends SagaIdentifier {
  causationList: Array<string>;
  destroyed: boolean;
  messagesToDispatch: Array<Command>;
  revision: number;
  state: Record<string, any>;
}

export interface SagaOptions<S extends State = State> extends SagaIdentifier {
  causationList?: Array<string>;
  destroyed?: boolean;
  messagesToDispatch?: Array<Command>;
  revision?: number;
  state?: S;
}

export interface SagaDispatchOptions {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
}

export interface ISaga extends SagaData {
  destroy(): void;
  dispatch(
    causation: DomainEvent,
    name: string,
    data: Record<string, any>,
    options?: SagaDispatchOptions,
  ): void;
  mergeState(data: Record<string, any>): void;
  setState(path: string, value: any): void;
  timeout(causation: DomainEvent, name: string, data: Record<string, any>, delay: number): void;
  toJSON(): SagaData;
}
