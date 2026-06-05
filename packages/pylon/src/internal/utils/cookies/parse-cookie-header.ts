import type { Dict } from "@lindorm/types";
import { RESTRICTED_NAMES_REGEXP } from "../../constants/regexp.js";

export type ParsedCookie = {
  name: string;
  signature: string | null;
  kid: string | null;
  value: string;
  chunkIndices?: Array<number>;
};

const CHUNK_SUFFIX_REGEXP = /^(.+)\.(\d+)$/;

export const parseCookieHeader = (header?: string): Array<ParsedCookie> => {
  if (!header) {
    return [];
  }

  const result: Dict<ParsedCookie> = {};
  const chunkBuckets: Dict<Array<{ index: number; value: string }>> = {};
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
      const chunkMatch = CHUNK_SUFFIX_REGEXP.exec(name);

      if (chunkMatch) {
        const baseName = chunkMatch[1];
        const index = Number(chunkMatch[2]);

        if (!chunkBuckets[baseName]) {
          chunkBuckets[baseName] = [];
        }
        chunkBuckets[baseName].push({ index, value });
      } else {
        if (result[name]) {
          result[name].value = value;
        } else {
          result[name] = { name, signature: null, kid: null, value };
        }
      }
    }
  }

  for (const [baseName, chunks] of Object.entries(chunkBuckets)) {
    const hasIndexZero = chunks.some((c) => c.index === 0);

    if (!hasIndexZero) {
      for (const chunk of chunks) {
        const chunkName = `${baseName}.${chunk.index}`;
        if (result[chunkName]) {
          result[chunkName].value = chunk.value;
        } else {
          result[chunkName] = {
            name: chunkName,
            signature: null,
            kid: null,
            value: chunk.value,
          };
        }
      }
      continue;
    }

    chunks.sort((a, b) => a.index - b.index);
    const joinedValue = chunks.map((c) => c.value).join("");
    const indices = chunks.map((c) => c.index);

    if (result[baseName]) {
      result[baseName].value = joinedValue;
      result[baseName].chunkIndices = indices;
    } else {
      result[baseName] = {
        name: baseName,
        signature: null,
        kid: null,
        value: joinedValue,
        chunkIndices: indices,
      };
    }
  }

  return Object.values(result);
};
