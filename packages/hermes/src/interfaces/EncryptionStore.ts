import { AesKit } from "@lindorm/aes";
import {
  AggregateIdentifier,
  EncryptionStoreAttributes,
  EncryptionStoreFindFilter,
} from "../types";

export interface IHermesEncryptionStore {
  inspect(aggregate: AggregateIdentifier): Promise<EncryptionStoreAttributes | undefined>;
  load(aggregate: AggregateIdentifier): Promise<AesKit>;
}

export interface IEncryptionStore {
  find(filter: EncryptionStoreFindFilter): Promise<EncryptionStoreAttributes | undefined>;
  insert(attributes: EncryptionStoreAttributes): Promise<void>;
}
