import { Message } from "./Message";
import { IMessage, MessageOptions } from "../types";
import { Command } from "./Command";
import { MessageType } from "../enum";

export class DomainEvent extends Message implements IMessage {
  public constructor(options: MessageOptions, causation?: Command) {
    super(
      {
        ...options,
        type: MessageType.DOMAIN_EVENT,
      },
      causation,
    );
  }
}
