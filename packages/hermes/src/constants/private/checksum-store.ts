import { ChecksumStoreAttributes, StoreIndexes } from "../../types";

export const CHECKSUM_STORE = "checksum_store";
export const CHECKSUM_STORE_INDEXES: StoreIndexes<ChecksumStoreAttributes> = [
  {
    fields: ["id", "name", "context", "event_id"],
    name: "checksum_store_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context"],
    name: "checksum_store_idx",
    unique: false,
  },
];
