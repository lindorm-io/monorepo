import { IMessageBus } from "@lindorm-io/amqp";
import { View } from "../../model";
import { EventEmitterListener } from "../event-emitter";
import { Data, State } from "../generic";
import { IViewEventHandler, ViewEventHandlerAdapter } from "../handler";
import { ViewIdentifier } from "../model";
import { IDomainViewStore } from "../view-store";

export type ViewDomainOptions = {
  messageBus: IMessageBus;
  store: IDomainViewStore;
};

export interface IViewDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: IViewEventHandler): Promise<void>;
  inspect<TState extends State = State>(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<View<TState>>;
}
