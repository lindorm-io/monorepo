import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IEventStore } from "../../interfaces";

export type EventStoreOptions = {
  custom?: IEventStore;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesEventStoreOptions = EventStoreOptions & { logger: ILogger };

export type EventStoreFindFilter = {
  id: string;
  name: string;
  namespace: string;
  causation_id?: string;
};
