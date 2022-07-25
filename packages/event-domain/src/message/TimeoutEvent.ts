import { IMessage, MessageOptions } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class TimeoutEvent extends Message implements IMessage {
  public constructor(options: MessageOptions, causation?: Message) {
    super(
      {
        ...options,
        mandatory: true,
        type: MessageType.TIMEOUT_EVENT,
      },
      causation,
    );
  }
}
