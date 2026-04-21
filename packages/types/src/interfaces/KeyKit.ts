import type { KeyData } from "../types/index.js";

export interface IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void;
  format(data: Buffer): string;
}
