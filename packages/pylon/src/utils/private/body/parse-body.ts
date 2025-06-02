import { ClientError } from "@lindorm/errors";
import CoBody from "co-body";
import { Files } from "formidable";
import { BodyType } from "../../../enums";
import { ParseBodyConfig, PylonHttpContext } from "../../../types";
import { parseWithFormidable } from "./parse-with-formidable";

type Result = {
  files?: Files;
  parsed?: any;
  raw?: any;
};

const encoding = "utf-8";
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

  switch (bodyType) {
    case BodyType.Json:
      return await CoBody.json(ctx, {
        encoding,
        limit: json,
        strict,
        returnRawBody,
      });

    case BodyType.UrlEncoded:
      return await CoBody.form(ctx, {
        encoding,
        limit: form,
        returnRawBody,
      });

    case BodyType.Text:
      return await CoBody.text(ctx, {
        encoding,
        limit: text,
        returnRawBody,
      });

    case BodyType.Multipart:
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
