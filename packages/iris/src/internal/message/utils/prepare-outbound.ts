import type { IAmphora } from "@lindorm/amphora";
import type { MessageMetadata } from "../types/metadata.js";
import type { OutboundPayload } from "../types/outbound-payload.js";
import { compress } from "./compress.js";
import { encryptPayload } from "./encrypt.js";
import { serializeMessage } from "./serialize-message.js";

export type { OutboundPayload };

export const prepareOutbound = async (
  message: any,
  metadata: MessageMetadata,
  amphora?: IAmphora,
): Promise<OutboundPayload> => {
  const serialized = serializeMessage(message, metadata);
  let payload: Buffer | string = serialized.body;
  const headers = { ...serialized.headers };

  if (metadata.compressed) {
    payload = await compress(
      Buffer.from(payload, "utf-8"),
      metadata.compressed.algorithm,
    );
    headers["x-iris-compression"] = metadata.compressed.algorithm;
  }

  if (metadata.encrypted) {
    const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf-8");
    payload = await encryptPayload(buf, amphora, metadata.encrypted.predicate);
    headers["x-iris-encrypted"] = "true";
  }

  if (!Buffer.isBuffer(payload)) {
    payload = Buffer.from(payload, "utf-8");
  }

  return { payload, headers };
};
