/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { HermesMetadata } from "../../classes/private";
import { GlobalThisHermes } from "../../types";

if (!(global as GlobalThisHermes).__lindorm_hermes__) {
  (global as GlobalThisHermes).__lindorm_hermes__ = new HermesMetadata();
}

export const globalHermesMetadata = (global as GlobalThisHermes).__lindorm_hermes__;
