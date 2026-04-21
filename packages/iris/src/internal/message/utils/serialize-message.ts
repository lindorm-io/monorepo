import { JsonKit } from "@lindorm/json-kit";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { MessageMetadata } from "../types/metadata.js";
import type { SerializedMessage } from "../types/serialized-message.js";

export type { SerializedMessage };

export const serializeMessage = (
  message: any,
  metadata: MessageMetadata,
): SerializedMessage => {
  const data: Record<string, unknown> = {};
  const headers: Record<string, string> = {};

  for (const field of metadata.fields) {
    let value = message[field.key];

    if (field.transform) {
      try {
        value = field.transform.to(value);
      } catch (error) {
        throw new IrisSerializationError(
          `@Transform.to failed for field "${field.key}"`,
          {
            error: error instanceof Error ? error : undefined,
          },
        );
      }
    }

    data[field.key] = value;
  }

  for (const header of metadata.headers) {
    const value = data[header.key];
    if (value !== undefined && value !== null) {
      headers[header.headerName] = String(value);
    }
    delete data[header.key];
  }

  let body: string;
  try {
    body = JsonKit.stringify(data);
  } catch (error) {
    throw new IrisSerializationError(
      `Failed to serialize message "${metadata.message.name}"`,
      { debug: { error: error instanceof Error ? error.message : String(error) } },
    );
  }

  return {
    body,
    headers,
  };
};
