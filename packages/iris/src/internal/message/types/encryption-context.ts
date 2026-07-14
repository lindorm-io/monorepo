import type { IAmphora } from "@lindorm/amphora";
import type { IrisEncryptionKey } from "../../../types/encryption.js";

/**
 * Everything the message pipeline needs to encrypt or decrypt a payload: the
 * vault, and the source-level key descriptor a message falls back to when its
 * own `@Encrypted` names no key.
 *
 * Built once by `IrisSource` and handed to the drivers, which only ever pass it
 * on to `prepareOutbound` / `prepareInbound`.
 */
export type MessageEncryptionContext = {
  amphora?: IAmphora;
  key?: IrisEncryptionKey;
};
