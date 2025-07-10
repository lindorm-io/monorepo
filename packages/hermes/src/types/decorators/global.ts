import { HermesMetadata } from "../../classes/private";

export type GlobalThisHermes = typeof globalThis & {
  __lindorm_hermes__: HermesMetadata;
};
