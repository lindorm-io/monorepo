import { getViewStoreIndexes } from "./view-store";

export const MAX_NAMESPACE_LENGTH = 32;
export const MAX_NAME_LENGTH = 64;

export const MAX_VIEW_LENGTH = ((): number => {
  const indexes = getViewStoreIndexes({
    name: "",
    namespace: "",
  })
    .map((index) => index.name)
    .sort((a, b) => b.length - a.length);

  return 62 - indexes[0].length;
})();
