import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IEventStore } from "../../interfaces";
import { AggregateIdentifier } from "../identifiers";

export type EventStoreOptions = {
  custom?: IEventStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesEventStoreOptions = EventStoreOptions & { logger: ILogger };

export type EventData = {
  id: string;
  aggregate: AggregateIdentifier;
  causation_id: string;
  correlation_id: string;
  data: Record<string, any>;
  meta: Record<string, any>;
  name: string;
  timestamp: Date;
  version: number;
};

export type EventStoreFindFilter = {
  id: string;
  name: string;
  context: string;
  causation_id?: string;
};
