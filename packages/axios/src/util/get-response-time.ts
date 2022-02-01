import { AnyObject, ResponseTime } from "../types";

const getHeaderTime = (headers: AnyObject): number | undefined => {
  try {
    const header = headers["x-response-time"];
    return parseInt(header.replace("ms", ""), 10);
  } catch (_) {
    return undefined;
  }
};

export const getResponseTime = (headers: AnyObject, start: number): ResponseTime => {
  const axios = Date.now() - start;
  const server = getHeaderTime(headers);
  const diff = server ? axios - server : undefined;

  return {
    axios,
    server,
    diff,
  };
};
