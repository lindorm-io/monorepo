import { Data } from "../generic";
import { EventEmitterListener } from "../event-emitter";
import { IDomainEventStore } from "../event-store";
import { IMessageBus } from "@lindorm-io/amqp";

export interface ReplayDomainOptions {
  context: string;
  eventStore: IDomainEventStore;
  messageBus: IMessageBus;
}

export interface ReplayOptions {
  aggregateContexts?: Array<string>;
  delay?: {
    start?: number;
    dropView?: number;
    moveView?: number;
    publishEvents?: number;
  };
  suffix?: string;
  views?: Array<string>;
}

export interface IReplayDomain {
  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void;
  replay(options: ReplayOptions): Promise<void>;
  subscribe(): Promise<void>;
}
