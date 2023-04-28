import { IMessageBus } from "@lindorm-io/amqp";
import { Saga } from "../../model";
import { EventEmitterListener } from "../event-emitter";
import { Data, State } from "../generic";
import { ISagaEventHandler } from "../handler";
import { SagaIdentifier } from "../model";
import { IDomainSagaStore } from "../saga-store";

export type SagaDomainOptions = {
  messageBus: IMessageBus;
  store: IDomainSagaStore;
};

export interface ISagaDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  registerEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  inspect<TState extends State = State>(sagaIdentifier: SagaIdentifier): Promise<Saga<TState>>;
}
