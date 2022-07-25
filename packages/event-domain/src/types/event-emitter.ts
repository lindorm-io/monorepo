import { State } from "./generic";
import { StandardIdentifier } from "./standard-identifier";

export interface EventEmitterData<S extends State = State> extends StandardIdentifier {
  revision: number;
  state: S;
}

export type EventEmitterListener<S extends State = State> = (data: EventEmitterData<S>) => void;
