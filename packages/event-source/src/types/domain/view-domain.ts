import { EventEmitterListener } from "../event-emitter";
import { IMessageBus } from "@lindorm-io/amqp";
import { IViewEventHandler } from "../handler";
import { IViewStore } from "../view-store";
import { State } from "../generic";

export interface ViewDomainOptions {
  messageBus: IMessageBus;
  store: IViewStore;
}

export interface IViewDomain {
  on<S = State>(eventName: string, listener: EventEmitterListener<S>): void;

  registerEventHandler(eventHandler: IViewEventHandler): Promise<void>;
  removeEventHandler(eventHandler: IViewEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;
}
