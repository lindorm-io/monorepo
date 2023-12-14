import { RsaKey } from "../../types";

export const isPrivateKey = (key: RsaKey): boolean => {
  const string = typeof key === "string" ? key : key.key;
  return string.includes("PRIVATE KEY");
};
