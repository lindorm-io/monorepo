import { createHash } from "crypto";
import { AesKeyLength } from "@lindorm/types";

type Options = {
  algorithm: string;
  apu?: Buffer;
  apv?: Buffer;
  keyLength: AesKeyLength;
  sharedSecret: Buffer;
};

type Result = {
  derivedKey: Buffer;
};

const lengthPrefixed = (data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, data]);
};

export const concatKdf = (options: Options): Result => {
  const algId = lengthPrefixed(Buffer.from(options.algorithm, "utf8"));
  const partyU = lengthPrefixed(options.apu ?? Buffer.alloc(0));
  const partyV = lengthPrefixed(options.apv ?? Buffer.alloc(0));
  const suppPub = Buffer.alloc(4);
  suppPub.writeUInt32BE(options.keyLength * 8);

  const otherInfo = Buffer.concat([algId, partyU, partyV, suppPub]);
  const round = Buffer.alloc(4);
  round.writeUInt32BE(1);

  const hash = createHash("sha256");
  hash.update(round);
  hash.update(options.sharedSecret);
  hash.update(otherInfo);

  return { derivedKey: hash.digest().subarray(0, options.keyLength) };
};
