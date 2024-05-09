import { _CustomSymbols } from "../../types/private/types";

const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{}~";
const TOKEN_SYMBOLS = "*-_~";
const UNRESERVED_SYMBOLS = "!()*-._~";

export const _getSymbols = (symbols: _CustomSymbols): string => {
  switch (symbols) {
    case "default":
      return SYMBOLS;
    case "token":
      return TOKEN_SYMBOLS;
    case "unreserved":
      return UNRESERVED_SYMBOLS;
    default:
      throw new Error("Invalid symbols");
  }
};
