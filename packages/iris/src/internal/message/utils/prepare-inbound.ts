import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { IrisCompressionAlgorithm } from "../../../types/compression.js";
import type { MessageMetadata } from "../types/metadata.js";
import { decompress } from "./compress.js";
import type { IAmphora } from "@lindorm/amphora";
import { decryptPayload } from "./encrypt.js";
import { deserializeMessage } from "./deserialize-message.js";

export const prepareInbound = async (
  payload: Buffer | string,
  headers: Record<string, string>,
  metadata: MessageMetadata,
  amphora?: IAmphora,
): Promise<Record<string, unknown>> => {
  let data: Buffer | string = payload;

  if (headers["x-iris-encrypted"] === "true" && metadata.encrypted) {
    const str = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
    data = await decryptPayload(str, amphora);
  }

  if (headers["x-iris-encrypted"] === "true" && !metadata.encrypted) {
    throw new IrisSerializationError(
      "Received encrypted message but @Encrypted is not configured on this message class",
    );
  }

  if (headers["x-iris-encrypted"] !== "true" && metadata.encrypted) {
    throw new IrisSerializationError(
      "Message requires encryption but received unencrypted payload",
    );
  }

  const compressionAlgorithm = headers["x-iris-compression"];
  if (compressionAlgorithm) {
    const validAlgorithms = new Set<string>(["gzip", "deflate", "brotli"]);
    if (!validAlgorithms.has(compressionAlgorithm)) {
      throw new IrisSerializationError(
        `Unsupported compression algorithm in header: "${compressionAlgorithm}"`,
      );
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    data = await decompress(buf, compressionAlgorithm as IrisCompressionAlgorithm);
  }

  const body = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
  return deserializeMessage(body, headers, metadata);
};
