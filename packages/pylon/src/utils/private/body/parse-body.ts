import { ClientError } from "@lindorm/errors";
import CoBody from "co-body";
import { Files } from "formidable";
import { BodyType, ParseBodyConfig, PylonHttpContext } from "../../../types";
import { getContentEncoding } from "./get-content-encoding";
import { parseWithFormidable } from "./parse-with-formidable";

type Result = {
  files?: Files;
  parsed?: any;
  raw?: any;
};

const UTF8 = "utf-8";
const returnRawBody = true;
const strict = true;

export const parseBody = async (
  ctx: PylonHttpContext,
  config: ParseBodyConfig,
  bodyType: BodyType,
): Promise<Result> => {
  const { json = "10mb", form = "1mb", text = "1mb" } = config.limits ?? {};

  const multipart =
    config.multipart ?? config.formidable ?? config.formidableOptions !== undefined;

  const formidable = config.formidable ?? config.formidableOptions !== undefined;

  const encoding = getContentEncoding(ctx.get("content-type")) ?? UTF8;

  switch (bodyType) {
    case "json":
      return await CoBody.json(ctx, {
        encoding,
        limit: json,
        strict,
        returnRawBody,
      });

    case "urlencoded":
      return await CoBody.form(ctx, {
        encoding,
        limit: form,
        returnRawBody,
      });

    case "text":
      return await CoBody.text(ctx, {
        encoding,
        limit: text,
        returnRawBody,
      });

    case "multipart":
      if (!multipart) {
        throw new ClientError("Multipart body is not supported", {
          status: ClientError.Status.BadRequest,
        });
      }
      if (formidable) {
        return await parseWithFormidable(ctx, config.formidableOptions);
      }
      return {};

    default:
      return {};
  }
};
