import { CustomSymbols } from "../../types/private";

const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{}~" as const;
const SECRET_SYMBOLS = "!#$%&()*+,-./:;<=>?[]^_{}~" as const;
const TOKEN_SYMBOLS = "*-_~" as const;
const UNRESERVED_SYMBOLS = "!()*-._~" as const;

export const getSymbols = (symbols: CustomSymbols): string => {
  switch (symbols) {
    case "default":
      return SYMBOLS;
    case "secret":
      return SECRET_SYMBOLS;
    case "token":
      return TOKEN_SYMBOLS;
    case "unreserved":
      return UNRESERVED_SYMBOLS;
    default:
      throw new Error("Invalid symbols");
  }
};
