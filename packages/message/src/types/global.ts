/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GlobalMessageMetadata as GlobalMessageMetadataImpl } from "../classes/private";
import { MetaField, MetaGenerated, MetaHook, MetaMessage, MetaSchema } from "./metadata";

export type GlobalMessageMetadata = {
  fields: Array<MetaField>;
  messages: Array<MetaMessage>;
  generated: Array<MetaGenerated>;
  hooks: Array<MetaHook>;
  schemas: Array<MetaSchema>;
};

export type GlobalThisMessage = typeof globalThis & {
  __lindorm_message__: GlobalMessageMetadataImpl;
};
