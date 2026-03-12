import type { Dict } from "@lindorm/types";

const snapshots = new WeakMap<object, Dict>();

export const storeSnapshot = (entity: object, dict: Dict): void => {
  snapshots.set(entity, dict);
};

export const getSnapshot = (entity: object): Dict | null => {
  return snapshots.get(entity) ?? null;
};

export const clearSnapshot = (entity: object): void => {
  snapshots.delete(entity);
};
