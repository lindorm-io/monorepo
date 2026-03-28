import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import type { IrisCompressionAlgorithm } from "../../../types/compression";
import type { MessageMetadata } from "../types/metadata";
import { decompress } from "./compress";
import type { IAmphora } from "@lindorm/amphora";
import { decryptPayload } from "./encrypt";
import { deserializeMessage } from "./deserialize-message";

export const prepareInbound = async (
  payload: Buffer | string,
  headers: Record<string, string>,
  metadata: MessageMetadata,
  amphora?: IAmphora,
): Promise<Record<string, unknown>> => {
  let data: Buffer | string = payload;

  if (headers["x-iris-encrypted"] === "true" && metadata.encrypted) {
    const str = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
    data = await decryptPayload(str, amphora, metadata.encrypted.predicate);
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
