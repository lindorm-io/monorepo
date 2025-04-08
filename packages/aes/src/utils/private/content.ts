import { isArray, isBuffer, isNumber, isObject, isString } from "@lindorm/is";
import { AesError } from "../../errors";
import { AesContent, AesContentType } from "../../types";

export const calculateContentType = (content: any): AesContentType => {
  if (isString(content)) {
    return "text/plain";
  }

  if (isBuffer(content)) {
    return "application/octet-stream";
  }

  if (isArray(content) || isNumber(content) || isObject(content)) {
    return "application/json";
  }

  throw new AesError("Invalid content type", {
    debug: { content, type: typeof content },
  });
};

export const contentToBuffer = (content: any, contentType: AesContentType): Buffer => {
  switch (contentType) {
    case "application/json":
      return Buffer.from(JSON.stringify(content), "utf8");

    case "application/octet-stream":
      return content;

    case "text/plain":
      return Buffer.from(content, "utf8");

    default:
      throw new AesError("Invalid content type", {
        debug: { content, type: typeof content },
      });
  }
};

export const parseContent = <T extends AesContent = string>(
  content: Buffer,
  contentType: AesContentType = "text/plain",
): T => {
  switch (contentType) {
    case "application/json":
      return JSON.parse(content.toString("utf8")) as T;

    case "application/octet-stream":
      return content as T;

    case "text/plain":
      return content.toString("utf8") as T;

    default:
      throw new AesError("Unexpected content type", {
        debug: { contentType },
      });
  }
};
