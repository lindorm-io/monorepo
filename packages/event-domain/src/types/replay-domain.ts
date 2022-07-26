import { EventStore, MessageBus, ViewStore } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";

export interface ReplayDomainOptions {
  eventStore: EventStore;
  messageBus: MessageBus;
  viewStore: ViewStore;
  logger: Logger;
  context: string;
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
