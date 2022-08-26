import { IDomainSagaStore } from "../saga-store";
import { IMessageBus } from "@lindorm-io/amqp";
import { ISagaEventHandler } from "../handler";
import { Saga } from "../../model";
import { SagaIdentifier } from "../model";
import { Data, State } from "../generic";
import { EventEmitterListener } from "../event-emitter";

export interface SagaDomainOptions {
  messageBus: IMessageBus;
  store: IDomainSagaStore;
}

export interface ISagaDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  inspect<TState extends State = State>(identifier: SagaIdentifier): Promise<Saga<TState>>;
}
