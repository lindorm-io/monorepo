import { IMessage, MessageOptions, SagaIdentifier, ViewIdentifier } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export type ErrorMessageData = {
  error: Error;
  message: IMessage;
  saga?: SagaIdentifier;
  view?: ViewIdentifier;
};

export class ErrorMessage extends MessageBase<ErrorMessageData> implements IMessage {
  public constructor(options: MessageOptions<ErrorMessageData>, causation?: IMessage) {
    super({ ...options, type: MessageType.ERROR_MESSAGE }, causation);
  }
}
