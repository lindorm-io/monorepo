import { Dict } from "@lindorm/types";
import { EventEmitterListener } from "../types/event-emitter";
import { IHermesChecksumEventHandler } from "./ChecksumEventHandler";

export interface IChecksumDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerEventHandler(eventHandler: IHermesChecksumEventHandler): Promise<void>;
}
