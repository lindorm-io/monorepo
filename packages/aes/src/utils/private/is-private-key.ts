import { AesCipherKey } from "../../types";

export const isPrivateKey = (key: AesCipherKey): boolean => {
  const string = typeof key === "string" ? key : key.key;
  return string.includes("PRIVATE KEY");
};
