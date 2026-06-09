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
      {
        code: "unexpected_encrypted_message",
        title: "Unexpected Encrypted Message",
        details:
          "An encrypted payload was received but the message class is not marked with @Encrypted. Add @Encrypted to the message class or stop encrypting the payload.",
      },
    );
  }

  if (headers["x-iris-encrypted"] !== "true" && metadata.encrypted) {
    throw new IrisSerializationError(
      "Message requires encryption but received unencrypted payload",
      {
        code: "missing_encrypted_payload",
        title: "Missing Encrypted Payload",
        details:
          "The message class is marked with @Encrypted but the received payload was not encrypted. Ensure the producer encrypts this message.",
      },
    );
  }

  const compressionAlgorithm = headers["x-iris-compression"];
  if (compressionAlgorithm) {
    const validAlgorithms = new Set<string>(["gzip", "deflate", "brotli"]);
    if (!validAlgorithms.has(compressionAlgorithm)) {
      throw new IrisSerializationError(
        `Unsupported compression algorithm in header: "${compressionAlgorithm}"`,
        {
          code: "unsupported_compression_algorithm",
          title: "Unsupported Compression Algorithm",
          details:
            "The inbound message declares a compression algorithm that is not supported. Supported algorithms are gzip, deflate, and brotli.",
          data: { algorithm: compressionAlgorithm },
        },
      );
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    data = await decompress(buf, compressionAlgorithm as IrisCompressionAlgorithm);
  }

  const body = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
  return deserializeMessage(body, headers, metadata);
};
