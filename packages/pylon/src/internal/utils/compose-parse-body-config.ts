import type { HttpMethod } from "@lindorm/types";
import type { ParseBodyConfig, ParseBodyOptions } from "../../types/index.js";

export const composeParseBodyConfig = (
  options: ParseBodyOptions = {},
): ParseBodyConfig => {
  const { formidableOptions = {} } = options;

  const { json = "1mb", form = "1mb", text = "1mb" } = options.limits ?? {};

  const formidable = options.formidable ?? options.formidableOptions !== undefined;
  const methods = (options.methods as Array<HttpMethod>) ?? ["POST", "PUT", "PATCH"];
  const multipart = options.multipart ?? formidable ?? false;

  return {
    formidable,
    formidableOptions,
    limits: {
      form,
      json,
      text,
    },
    methods,
    multipart,
  };
};
