/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GlobalMessageMetadata } from "../classes/private";
import { GlobalThisMessage } from "../types";

if (!(global as GlobalThisMessage).__lindorm_message__) {
  (global as GlobalThisMessage).__lindorm_message__ = new GlobalMessageMetadata();
}

export const globalMessageMetadata = (global as GlobalThisMessage).__lindorm_message__;
