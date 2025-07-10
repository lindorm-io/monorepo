import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { Dict } from "@lindorm/types";
import { IHermesMessageBus, IHermesRegistry, IHermesViewStore } from "../../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../../messages";

export type ViewDomainOptions = {
  commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  errorBus: IHermesMessageBus<HermesError>;
  eventBus: IHermesMessageBus<HermesEvent>;
  logger: ILogger;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
  redis?: IRedisSource;
  registry: IHermesRegistry;
  store: IHermesViewStore;
};
