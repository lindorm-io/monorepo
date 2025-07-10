import { Dict } from "@lindorm/types";
import { SagaIdentifier } from "../types";
import { EventEmitterListener } from "../types/event-emitter";
import { ISagaModel } from "./SagaModel";

export interface ISagaDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerHandlers(): Promise<void>;
  inspect<S extends Dict = Dict>(sagaIdentifier: SagaIdentifier): Promise<ISagaModel<S>>;
}
