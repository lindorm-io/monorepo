import { IKryptosOct } from "../interfaces";
import { KryptosKit } from "../classes";

export const MOCK_KRYPTOS_OCT_SIG_HS256 = KryptosKit.from.b64({
  id: "245fb48b-c9fb-408a-882f-46589efb6611",
  algorithm: "HS256",
  type: "oct",
  use: "sig",
  privateKey:
    "RxlzoIQ1LpK3PAdCwR7Cm-zl5ZsDqvNPO5gqrMdpg6Nt_nD9lUSARNzinRwyoZGIfZSDUzxFSQbPYj0KnXIIoQ",
}) as IKryptosOct;

export const MOCK_KRYPTOS_OCT_SIG_HS384 = KryptosKit.from.b64({
  id: "c5d3d569-2424-4da5-8713-5c066dd19487",
  algorithm: "HS384",
  type: "oct",
  use: "sig",
  privateKey:
    "xkNYLR6_YJb-RhsXg9jLqsreplY3cEIs2jEMBlZhQOxEsPELyrc-ZjF59YWZmfwYULDX4htO7iOwVPlGslgoQFA6b5eH6fIcRg01c7L4rtVBn1dtfJEHfUY-DK2I9_TA",
}) as IKryptosOct;

export const MOCK_KRYPTOS_OCT_SIG_HS512 = KryptosKit.from.b64({
  id: "1bbdc76e-b1a2-497d-9b11-f6a29a0a024d",
  algorithm: "HS512",
  type: "oct",
  use: "sig",
  privateKey:
    "z0VwDUgLbRnAGgOJ3Mt3Di5GRN3n575-UYes9DFlHEAnwwdwPHLyyXmtfxOh-QnhvjcSEYArAl1-Tp7sTFgsaHWGw8yxb5XyGqTv3HPz2s5QGsW8uEX2S0GzJDwWVNqrBPjC_Ztl8axrM7JGGZgXgspJGBWrOrfLMtdFsryZ3mg",
}) as IKryptosOct;

export const MOCK_KRYPTOS_OCT_ENC = KryptosKit.from.b64({
  id: "5d4bc3dc-e25c-44e8-90ee-d8b811056d1d",
  algorithm: "dir",
  type: "oct",
  use: "enc",
  privateKey: "oWOn1-blpE0Ku3YqfCJasgNjFTgnRKZ4UWBGC7MJLrE",
}) as IKryptosOct;
