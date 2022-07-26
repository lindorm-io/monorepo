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
  dropViews?: Array<string>;
  startDelay?: number;
}

export interface IReplayDomain {
  on(eventName: string, listener: () => void): void;
  replay(options: ReplayOptions): Promise<void>;
  subscribe(): Promise<void>;
}
