import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { DomainEvent } from "../../message";
import { ChecksumStoreAttributes } from "./checksum-store-attributes";

export type ChecksumStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export type ChecksumStoreOptions = {
  custom?: IChecksumStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: ChecksumStoreAdapterType;
};

export type ChecksumStoreFindFilter = {
  id: string;
  name: string;
  context: string;
  event_id: string;
};

export interface IDomainChecksumStore {
  verify(event: DomainEvent): Promise<void>;
}

export interface IChecksumStore {
  find(filter: ChecksumStoreFindFilter): Promise<ChecksumStoreAttributes | undefined>;
  insert(attributes: ChecksumStoreAttributes): Promise<void>;
}
