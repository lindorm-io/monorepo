import { IMessageBus } from "@lindorm-io/amqp";
import { ISagaStore } from "./saga-store";
import { ISagaEventHandler } from "./saga-event-handler";
import { State } from "./generic";
import { SagaIdentifier } from "./saga";
import { Saga } from "../model";

export interface SagaDomainOptions {
  messageBus: IMessageBus;
  store: ISagaStore;
}

export interface ISagaDomain {
  registerEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  removeEventHandler(eventHandler: ISagaEventHandler): Promise<void>;
  removeAllEventHandlers(): Promise<void>;

  inspect<S extends State = State>(identifier: SagaIdentifier): Promise<Saga<S>>;
}
