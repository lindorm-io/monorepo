import { getViewStoreName } from "../util";
import {
  StoreIndexes,
  ViewStoreAttributes,
  ViewCausationAttributes,
  HandlerIdentifier,
} from "../types";

export const getViewStoreIndexes = (view: HandlerIdentifier): StoreIndexes<ViewStoreAttributes> => {
  const storeName = getViewStoreName(view);
  return [
    {
      fields: ["id", "name", "context"],
      name: `${storeName}_pkey`,
      unique: true,
    },
    {
      fields: ["id", "name", "context", "destroyed"],
      name: `${storeName}_id_name_context_destroyed_idx`,
      unique: false,
    },
    {
      fields: ["id", "name", "context", "hash", "revision"],
      name: `${storeName}_id_name_context_hash_revision_idx`,
      unique: false,
    },
  ];
};

export const VIEW_CAUSATION = "view_causation";
export const VIEW_CAUSATION_INDEXES: StoreIndexes<ViewCausationAttributes> = [
  {
    fields: ["id", "name", "context", "causation_id"],
    name: "view_causation_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context"],
    name: "view_causation_id_name_context_idx",
    unique: false,
  },
];
