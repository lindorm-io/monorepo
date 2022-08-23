import { AggregateIdentifier } from "./aggregate";
import { ClassConstructor, State } from "../generic";
import { Command, DomainEvent } from "../../message";
import { StandardIdentifier } from "../standard-identifier";

export type SagaIdentifier = StandardIdentifier;

export interface SagaData extends SagaIdentifier {
  destroyed: boolean;
  hash: string;
  messagesToDispatch: Array<Command>;
  processedCausationIds: Array<string>;
  revision: number;
  state: Record<string, any>;
}

export interface SagaOptions<TState extends State = State> extends SagaIdentifier {
  destroyed?: boolean;
  hash?: string;
  messagesToDispatch?: Array<Command>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: TState;
}

export interface SagaDispatchOptions {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
  version?: number;
}

export interface ISaga extends SagaData {
  destroy(): void;
  dispatch(causation: DomainEvent, command: ClassConstructor, options?: SagaDispatchOptions): void;
  mergeState(data: Record<string, any>): void;
  setState(path: string, value: any): void;
  timeout(causation: DomainEvent, name: string, data: Record<string, any>, delay: number): void;
  toJSON(): SagaData;
}
