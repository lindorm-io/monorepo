import { HEADER_SYMBOL } from "../../constants";

export const isOctSecret = (secret: string): boolean => {
  return (
    !!secret &&
    typeof secret === "string" &&
    secret.split("").filter((char) => char === HEADER_SYMBOL).length === 4
  );
};
