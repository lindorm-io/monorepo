import { PylonHandlerResult } from "../../types";

export const getStatus = (response: PylonHandlerResult): number => {
  const { body, file, location, redirect, stream, status } = response;

  if (status) {
    return status;
  }

  if (location) {
    return 201;
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
