import type { IAmphora } from "@lindorm/amphora";
import type { Constructor } from "@lindorm/types";
import { IrisSourceError } from "../../errors/IrisSourceError";
import type { IMessage } from "../../interfaces/Message";
import { getMessageMetadata } from "../message/metadata/get-message-metadata";

export const validateEncryptedMessages = (
  messages: Array<Constructor<IMessage>>,
  amphora: IAmphora | undefined,
): void => {
  for (const target of messages) {
    const metadata = getMessageMetadata(target);
    if (metadata.encrypted && !amphora) {
      throw new IrisSourceError(
        `Message "${metadata.message.name}" uses @Encrypted but no amphora instance was provided to IrisSource`,
      );
    }
  }
};
