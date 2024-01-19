import { Dict } from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { RandomStringAmount, randomToken } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { TokenHeaderType } from "../../enum";

export type CreateOpaqueTokenOptions = {
  id?: string;
  header?: Dict;
  length?: number;
  numbers?: RandomStringAmount;
  roles?: Array<string>;
  symbols?: RandomStringAmount;
};

export type CreateOpaqueToken = {
  id: string;
  roles?: Array<string>;
  signature: string;
  token: string;
};

export type OpaqueTokenHeader<T = Dict> = {
  oti?: string;
  typ: TokenHeaderType;
} & T;

export const createOpaqueToken = (options: CreateOpaqueTokenOptions = {}): CreateOpaqueToken => {
  const {
    id = randomUUID(),
    header = {},
    length = 128,
    roles = [],
    numbers = "random",
    symbols = "10%",
  } = options;

  const head: OpaqueTokenHeader = {
    ...(id ? { oti: id } : {}),
    typ: TokenHeaderType.OPAQUE,
    ...header,
  };

  const hashed = baseHash(JSON.stringify(head)).replace(/=/g, "");
  const signature = randomToken(length, { numbers, symbols });
  const token = `${hashed}.${signature}`;

  return { id, roles, signature, token };
};
