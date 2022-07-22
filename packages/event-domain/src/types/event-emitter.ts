import { AggregateIdentifier } from "./aggregate";
import { ViewIdentifier } from "./view";

interface DomainEventData {
  aggregate: AggregateIdentifier;
  name: string;
}

interface ViewData<State> extends ViewIdentifier {
  revision: number;
  state: State;
}

type EventEmitterErrorCallback = (error: Error | null) => void;
type EventEmitterEventCallback<State> = (event: DomainEventData, view: ViewData<State>) => void;

export type EventEmitterEvt = "error" | "event";

export type EventEmitterCallback<State> =
  | EventEmitterErrorCallback
  | EventEmitterEventCallback<State>;
