import { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IEncryptionStore } from "../../interfaces";
import { StandardIdentifier } from "../identifiers";

export type EncryptionStoreOptions = {
  algorithm?: KryptosEncAlgorithm;
  custom?: IEncryptionStore;
  encryption?: KryptosEncryption;
  mongo?: IMongoSource;
  postgres?: IPostgresSource;
};

export type HermesEncryptionStoreOptions = EncryptionStoreOptions & { logger: ILogger };

export type EncryptionStoreFindFilter = StandardIdentifier;
