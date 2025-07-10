import { EncryptionStoreAttributes, StoreIndexes } from "../../types";

export const ENCRYPTION_STORE = "encryption_store";
export const ENCRYPTION_STORE_INDEXES: StoreIndexes<EncryptionStoreAttributes> = [
  {
    fields: ["id", "name", "namespace"],
    name: "encryption_store_pkey",
    unique: true,
  },
];
