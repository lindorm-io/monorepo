import { getViewStoreIndexes } from "./view-store";

export const MAX_CONTEXT_LENGTH = 32;
export const MAX_NAME_LENGTH = 64;

export const MAX_VIEW_LENGTH = ((): number => {
  const indexes = getViewStoreIndexes({
    name: "",
    context: "",
  })
    .map((index) => index.name)
    .sort((a, b) => b.length - a.length);

  return 62 - indexes[0].length;
})();
