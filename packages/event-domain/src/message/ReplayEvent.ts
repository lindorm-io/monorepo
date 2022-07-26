import { IMessage, ReplayEventData, MessageOptions } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class ReplayEvent extends Message<ReplayEventData> implements IMessage {
  public constructor(options: MessageOptions<ReplayEventData>, causation?: Message) {
    super(
      {
        ...options,
        type: MessageType.REPLAY_EVENT,
      },
      causation,
    );
  }
}
