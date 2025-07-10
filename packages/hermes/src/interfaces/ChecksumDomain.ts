import { Dict } from "@lindorm/types";
import { EventEmitterListener } from "../types/event-emitter";

export interface IChecksumDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerHandlers(): Promise<void>;
}
