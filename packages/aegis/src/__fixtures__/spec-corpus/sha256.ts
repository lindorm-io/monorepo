import { ShaKit } from "@lindorm/sha";

const KIT = new ShaKit({ algorithm: "SHA256", encoding: "hex" });

export const sha256 = (data: string): string => KIT.hash(data);
