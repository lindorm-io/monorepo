import { Dict } from "@lindorm/types";
import { SagaIdentifier } from "../types";
import { EventEmitterListener } from "../types/event-emitter";
import { ISaga } from "./Saga";
import { IHermesSagaEventHandler } from "./SagaEventHandler";

export interface ISagaDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerEventHandler(eventHandler: IHermesSagaEventHandler): Promise<void>;
  inspect<S extends Dict = Dict>(sagaIdentifier: SagaIdentifier): Promise<ISaga<S>>;
}
