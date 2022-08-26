import { Data, State } from "./generic";
import { StandardIdentifier } from "./standard-identifier";

export interface EventEmitterSagaData<TState extends State = State> extends StandardIdentifier {
  destroyed: boolean;
  state: TState;
}

export interface EventEmitterViewData<TState extends State = State> extends StandardIdentifier {
  destroyed: boolean;
  revision: number;
  state: TState;
}

export type EventEmitterListener<TData = Data> = (data: TData) => void;
