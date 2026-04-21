import type { CorsOptions } from "../../../types/index.js";

export const validateCorsOptions = (options: CorsOptions): void => {
  if (options.allowOrigins === "*" && options.allowCredentials) {
    throw new Error("Cannot set allowCredentials to true when allowOrigins is set to *");
  }
};
