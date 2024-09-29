import { ChecksumStoreAttributes, ChecksumStoreFindFilter } from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface IHermesChecksumStore {
  verify(event: IHermesMessage): Promise<void>;
}

export interface IChecksumStore {
  find(filter: ChecksumStoreFindFilter): Promise<ChecksumStoreAttributes | undefined>;
  insert(attributes: ChecksumStoreAttributes): Promise<void>;
}
