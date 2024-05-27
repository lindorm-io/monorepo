import { PylonHandlerResult } from "../../types";

export const getStatus = (response: PylonHandlerResult): number => {
  const { body, file, redirect, stream, status } = response;

  if (status) {
    return status;
  }

  if (redirect && body) {
    return 308;
  }

  if (redirect) {
    return 302;
  }

  if (body || file || stream) {
    return 200;
  }

  return 204;
};
