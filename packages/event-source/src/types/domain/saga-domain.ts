import { IMessageBus } from "@lindorm-io/amqp";
import { ISagaEventHandler } from "../handler";
import { ISagaStore } from "../saga-store";
import { Saga } from "../../model";
import { SagaIdentifier } from "../model";
import { State } from "../generic";

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
