import { AesKeyObject } from "../../types";

export const isPrivateKey = (key: AesKeyObject): boolean => key.key.includes("PRIVATE KEY");
