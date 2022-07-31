import { Data, State } from "./generic";
import { StandardIdentifier } from "./standard-identifier";

export interface EventEmitterData<S extends State = State> extends StandardIdentifier {
  revision: number;
  state: S;
}

export type EventEmitterListener<D = Data> = (data: D) => void;
