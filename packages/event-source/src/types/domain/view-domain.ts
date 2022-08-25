import { Data } from "../generic";
import { EventEmitterListener } from "../event-emitter";
import { IDomainViewStore } from "../view-store";
import { IMessageBus } from "@lindorm-io/amqp";
import { IViewEventHandler } from "../handler";

export interface ViewDomainOptions {
  messageBus: IMessageBus;
  store: IDomainViewStore;
}

export interface IViewDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: IViewEventHandler): Promise<void>;
}
