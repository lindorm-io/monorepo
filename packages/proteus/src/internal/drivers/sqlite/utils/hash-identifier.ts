import { ShaKit } from "@lindorm/sha";

export const hashIdentifier = (input: string): string => ShaKit.S256(input).slice(0, 11);
