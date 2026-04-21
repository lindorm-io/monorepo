import { isNumber } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { PylonHandlerResult } from "../../types/index.js";

type Body = Dict | undefined;

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
