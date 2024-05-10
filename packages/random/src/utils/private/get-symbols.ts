import { _CustomSymbols } from "../../types/private/types";

const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{}~" as const;
const SECRET_SYMBOLS = "!#$%&()*+,-./:;<=>?[]^_{}~" as const;
const TOKEN_SYMBOLS = "*-_~" as const;
const UNRESERVED_SYMBOLS = "!()*-._~" as const;

export const _getSymbols = (symbols: _CustomSymbols): string => {
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
