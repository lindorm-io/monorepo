import {
  HandlerIdentifier,
  StoreIndexes,
  ViewCausationAttributes,
  ViewStoreAttributes,
} from "../../types";
import { getViewStoreName } from "../../utils/private";

export const getViewStoreIndexes = (
  view: HandlerIdentifier,
): StoreIndexes<ViewStoreAttributes> => {
  const storeName = getViewStoreName(view);
  return [
    {
      fields: ["id", "name", "context"],
      name: `${storeName}_pkey`,
      unique: true,
    },
    {
      fields: ["id", "name", "context", "destroyed"],
      name: `${storeName}_idx1`,
      unique: false,
    },
    {
      fields: ["id", "name", "context", "revision"],
      name: `${storeName}_idx2`,
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
    name: "view_causation_idx",
    unique: false,
  },
];
