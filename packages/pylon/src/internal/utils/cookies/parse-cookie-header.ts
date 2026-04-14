import { Dict } from "@lindorm/types";
import { RESTRICTED_NAMES_REGEXP } from "../../constants/regexp";

export type ParsedCookie = {
  name: string;
  signature: string | null;
  kid: string | null;
  value: string;
};

export const parseCookieHeader = (header?: string): Array<ParsedCookie> => {
  if (!header) {
    return [];
  }

  const result: Dict<ParsedCookie> = {};
  const pattern = /([^=;]+)=([^;]*)(;|$)/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(header))) {
    const name = match[1].trim();
    const value = match[2].trim();

    if (RESTRICTED_NAMES_REGEXP.test(name)) {
      continue;
    }

    if (name.endsWith(".sig")) {
      const baseName = name.slice(0, -4);

      if (result[baseName]) {
        result[baseName].signature = value;
      } else {
        result[baseName] = { name: baseName, signature: value, kid: null, value: "" };
      }
    } else if (name.endsWith(".kid")) {
      const baseName = name.slice(0, -4);

      if (result[baseName]) {
        result[baseName].kid = value;
      } else {
        result[baseName] = { name: baseName, signature: null, kid: value, value: "" };
      }
    } else {
      if (result[name]) {
        result[name].value = value;
      } else {
        result[name] = { name, signature: null, kid: null, value };
      }
    }
  }

  return Object.values(result);
};
