import { HttpMethod } from "@lindorm/enums";
import { ParseBodyConfig, ParseBodyOptions } from "../../types";

export const composeParseBodyConfig = (options?: ParseBodyOptions): ParseBodyConfig => {
  const {
    formidableOptions = {},
    methods = [HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch],
  } = options ?? {};

  const { json = "1mb", form = "1mb", text = "1mb" } = options?.limits ?? {};

  const formidable =
    options?.formidable ?? options?.formidableOptions !== undefined ?? false;

  const multipart = options?.multipart ?? formidable ?? false;

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
