import { IMessageBus } from "@lindorm-io/amqp";
import { EventEmitterListener } from "../event-emitter";
import { IDomainEventStore } from "../event-store";
import { Data } from "../generic";

export type ReplayDomainOptions = {
  context: string;
  eventStore: IDomainEventStore;
  messageBus: IMessageBus;
};

export type ReplayOptions = {
  aggregateContexts?: Array<string>;
  delay?: {
    start?: number;
    dropView?: number;
    moveView?: number;
    publishEvents?: number;
  };
  suffix?: string;
  views?: Array<string>;
};

export interface IReplayDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  replay(options: ReplayOptions): Promise<void>;
  subscribe(): Promise<void>;
}
