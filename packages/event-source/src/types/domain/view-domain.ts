import { Data, State } from "../generic";
import { EventEmitterListener } from "../event-emitter";
import { IDomainViewStore } from "../view-store";
import { IMessageBus } from "@lindorm-io/amqp";
import { IViewEventHandler, ViewEventHandlerAdapter } from "../handler";
import { View } from "../../model";
import { ViewIdentifier } from "../model";

export interface ViewDomainOptions {
  messageBus: IMessageBus;
  store: IDomainViewStore;
}

export interface IViewDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: IViewEventHandler): Promise<void>;
  inspect<TState extends State = State>(
    identifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<View<TState>>;
}
