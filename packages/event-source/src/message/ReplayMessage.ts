import { IMessage, MessageOptions, Data } from "../types";
import { MessageBase } from "./MessageBase";
import { MessageType } from "../enum";

export class ReplayMessage<D extends Data = Data> extends MessageBase<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: IMessage) {
    super({ ...options, mandatory: true, type: MessageType.REPLAY_MESSAGE }, causation);
  }
}
