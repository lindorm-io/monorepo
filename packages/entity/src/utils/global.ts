/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GlobalEntityMetadata } from "../classes/private";
import { GlobalThisEntity } from "../types";

if (!(global as GlobalThisEntity).__lindorm_entity__) {
  (global as GlobalThisEntity).__lindorm_entity__ = new GlobalEntityMetadata();
}

export const globalEntityMetadata = (global as GlobalThisEntity).__lindorm_entity__;
