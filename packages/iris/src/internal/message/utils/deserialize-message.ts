import { JsonKit } from "@lindorm/json-kit";
import type { MessageMetadata } from "../types/metadata";

export const deserializeMessage = (
  body: string,
  headers: Record<string, string>,
  metadata: MessageMetadata,
): Record<string, unknown> => {
  const data = JsonKit.parse<Record<string, unknown>>(body);

  for (const header of metadata.headers) {
    if (header.headerName in headers) {
      data[header.key] = headers[header.headerName];
    }
  }

  return data;
};
