import { IMessageBus } from "@lindorm-io/amqp";
import { IDomainChecksumStore } from "../checksum-store";
import { EventEmitterListener } from "../event-emitter";
import { Data } from "../generic";
import { IChecksumEventHandler } from "../handler";

export type ChecksumDomainOptions = {
  messageBus: IMessageBus;
  store: IDomainChecksumStore;
};

export interface IChecksumDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: IChecksumEventHandler): Promise<void>;
}
