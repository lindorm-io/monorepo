import type { PylonCorsSettings } from "../../../types/index.js";

export const validateCorsOptions = (options: PylonCorsSettings): void => {
  if (options.allowOrigins === "*" && options.allowCredentials) {
    throw new Error("Cannot set allowCredentials to true when allowOrigins is set to *");
  }
};
