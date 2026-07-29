import type { Constructor } from "@lindorm/types";
import { IrisSourceError } from "../../errors/IrisSourceError.js";
import type { IMessage } from "../../interfaces/Message.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";
import { hasEncryptionKey } from "../message/utils/has-encryption-key.js";
import { mergeEncryptionKey } from "../message/utils/merge-encryption-key.js";

/**
 * Every `@Encrypted` message must resolve to a vault AND to a key — from the
 * decorator or from the source-level `encryption` default — and it must do so
 * when the source LOADS, not at the first publish.
 *
 * A message that names no key would otherwise select "the newest key, whatever
 * it is". That is not a policy, and the floor alone cannot rescue it: it would
 * still hand the payload to whichever encryption key happened to be minted last.
 */
export const validateEncryptedMessages = (
  messages: Array<Constructor<IMessage>>,
  encryption: MessageEncryptionContext,
): void => {
  for (const target of messages) {
    const metadata = getMessageMetadata(target);

    if (!metadata.encrypted) continue;

    if (!encryption.amphora) {
      throw new IrisSourceError(
        `Message "${metadata.message.name}" uses @Encrypted but no amphora instance was provided to IrisSource`,
        {
          code: "missing_amphora_instance",
          title: "Missing Amphora Instance",
          details:
            "A registered message is marked with @Encrypted but no Amphora instance was provided to IrisSource. Provide an Amphora when constructing the source.",
          data: { message: metadata.message.name },
        },
      );
    }

    if (!hasEncryptionKey(mergeEncryptionKey(metadata.encrypted, encryption.key))) {
      throw new IrisSourceError(
        `Message "${metadata.message.name}" uses @Encrypted but names no encryption key`,
        {
          code: "missing_encryption_key",
          title: "Missing Encryption Key",
          details:
            "A registered message is marked with @Encrypted but names no key. Give the decorator a kryptos or a condition — @Encrypted({ kryptos: KEK }) or @Encrypted({ condition: { purpose: 'message' } }) — or set the encryption default on IrisSource. Without one the lookup is unscoped, and selects whatever key is newest.",
          data: { message: metadata.message.name },
        },
      );
    }
  }
};
