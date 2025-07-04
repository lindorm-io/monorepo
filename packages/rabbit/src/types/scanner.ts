import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";

export type MessageScannerInput<M extends IMessage = IMessage> = Array<
  Constructor<M> | string
>;
