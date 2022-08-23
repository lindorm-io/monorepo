import { IDomainSagaStore } from "../saga-store";
import { IMessageBus } from "@lindorm-io/amqp";
import { ISagaEventHandler } from "../handler";
import { Saga } from "../../entity";
import { SagaIdentifier } from "../entity";
import { State } from "../generic";

export interface SagaDomainOptions {
  messageBus: IMessageBus;
  store: IDomainSagaStore;
}

export interface ISagaDomain {
  registerEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  removeEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;

  inspect<TState extends State = State>(identifier: SagaIdentifier): Promise<Saga<TState>>;
}
