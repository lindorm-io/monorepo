import { Data, State } from "./generic";
import { StandardIdentifier } from "./standard-identifier";

export interface EventEmitterData<TState extends State = State> extends StandardIdentifier {
  destroyed: boolean;
  revision: number;
  state: TState;
}

export type EventEmitterListener<D = Data> = (data: D) => void;
