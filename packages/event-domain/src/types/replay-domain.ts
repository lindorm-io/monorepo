import { IDomainEventStore } from "./event-store";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";

export interface ReplayDomainOptions {
  context: string;
  eventStore: IDomainEventStore;
  logger: ILogger;
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
  on(eventName: string, listener: () => void): void;
  replay(options: ReplayOptions): Promise<void>;
  subscribe(): Promise<void>;
}
