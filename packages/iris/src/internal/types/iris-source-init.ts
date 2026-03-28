import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../interfaces/IrisDriver";
import type { IMessage } from "../../interfaces/Message";
import type { IMessageSubscriber } from "../../interfaces/MessageSubscriber";
import type { IrisDriverType, IrisSourceOptions } from "../../types";
import type { DeadLetterManager } from "../dead-letter/DeadLetterManager";
import type { DelayManager } from "../delay/DelayManager";
import type { IAmphora } from "@lindorm/amphora";

export type IrisSourceInit = {
  _driver: IIrisDriver | undefined;
  _options: IrisSourceOptions;
  _amphora: IAmphora | undefined;
  _delayManager: DelayManager | undefined;
  _deadLetterManager: DeadLetterManager | undefined;
  logger: ILogger;
  context: unknown;
  _messages: Array<Constructor<IMessage>>;
  _driverType: IrisDriverType;
  _subscribersRef: { current: Array<IMessageSubscriber> };
  _connectingPromise: Promise<void> | null;
  _disconnectingPromise: Promise<void> | null;
  _settingUpPromise: Promise<void> | null;
  isSetUp: boolean;
  _isClone: boolean;
};
