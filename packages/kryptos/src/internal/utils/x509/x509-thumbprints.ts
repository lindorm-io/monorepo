import { ShaKit } from "@lindorm/sha";

export const x5tS256 = (der: Buffer): string => ShaKit.S256(der);
