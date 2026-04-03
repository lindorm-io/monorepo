import { isNumber } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { PylonHandlerResult } from "../../types";

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
