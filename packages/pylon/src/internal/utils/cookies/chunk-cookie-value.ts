import { ServerError } from "@lindorm/errors";
import { PylonCookie } from "../../classes/PylonCookie.js";
import type { PylonCookieOptions } from "../../../types/index.js";

export type ChunkCookieValueOptions = {
  name: string;
  value: string;
  options: PylonCookieOptions;
  chunkSize: number;
};

export type ChunkCookieValueResult = {
  name: string;
  value: string;
};

export const chunkCookieValue = ({
  name,
  value,
  options,
  chunkSize,
}: ChunkCookieValueOptions): Array<ChunkCookieValueResult> => {
  const bareOverhead = new PylonCookie(name, "", options).toHeader().length;

  if (bareOverhead + value.length <= chunkSize) {
    return [{ name, value }];
  }

  const chunkedOverhead = new PylonCookie(`${name}.0`, "", options).toHeader().length;
  const valueBudget = chunkSize - chunkedOverhead;

  if (valueBudget <= 0) {
    throw new ServerError("Cookie chunk size too small", {
      code: "invalid_cookie_chunk_size",
      debug: { name, chunkSize, chunkedOverhead },
    });
  }

  const chunkCount = Math.ceil(value.length / valueBudget);
  const chunks: Array<ChunkCookieValueResult> = [];

  for (let i = 0; i < chunkCount; i++) {
    const slice = value.slice(i * valueBudget, (i + 1) * valueBudget);
    chunks.push({ name: `${name}.${i}`, value: slice });
  }

  return chunks;
};
