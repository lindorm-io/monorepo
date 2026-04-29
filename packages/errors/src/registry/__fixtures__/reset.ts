import { errorRegistry } from "../ErrorRegistry.js";

export const resetErrorRegistry = (): void => {
  // @ts-expect-error — clear is private by design; this is the sanctioned bypass.
  errorRegistry.clear();
};
