import { EntityScannerInput } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";

export type CloneMnemosSourceOptions = {
  logger?: ILogger;
};

export type MnemosSourceRepositoryOptions = {
  logger?: ILogger;
  namespace?: string;
};

export type MnemosSourceOptions = {
  entities?: EntityScannerInput;
  logger: ILogger;
};
