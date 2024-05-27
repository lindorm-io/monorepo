import { isNumber } from "@lindorm/is";
import { PylonHandlerResult } from "../../types";

type Body = Record<string, any> | undefined;

export const getBody = (response: PylonHandlerResult): Body => {
  const { body, file, status, stream } = response;

  if (file || stream) {
    return undefined;
  }

  if (body) {
    return body;
  }

  if (isNumber(status) && status !== 204) {
    return {};
  }

  return undefined;
};
