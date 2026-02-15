import { IKryptosEc } from "@lindorm/kryptos";
import { EcError } from "../../errors";

const KEY_SIZES = {
  "P-256": 32,
  "P-384": 48,
  "P-521": 66,
};

export const derToRaw = (kryptos: IKryptosEc, derSignature: Buffer): Buffer => {
  const keySize = KEY_SIZES[kryptos.curve];

  if (derSignature[0] !== 0x30) {
    throw new EcError("Invalid DER format");
  }

  let position = 2; // Skip 0x30 and the length byte(s)

  // Handle multi-byte length encoding
  const lengthByte = derSignature[1];
  if (lengthByte > 0x80) {
    const lengthBytesCount = lengthByte & 0x7f;
    position += lengthBytesCount;
  }

  function getInteger(): Buffer {
    if (derSignature[position] !== 0x02) {
      throw new EcError("Expected integer");
    }
    const length = derSignature[position + 1];
    position += 2;
    const value = derSignature.subarray(position, position + length);
    position += length;
    return value;
  }

  const r = getInteger();
  const s = getInteger();

  const truncatedR = r.length > keySize ? r.subarray(r.length - keySize) : r;
  const truncatedS = s.length > keySize ? s.subarray(s.length - keySize) : s;

  const paddedR = Buffer.concat([
    Buffer.alloc(keySize - truncatedR.length, 0),
    truncatedR,
  ]);
  const paddedS = Buffer.concat([
    Buffer.alloc(keySize - truncatedS.length, 0),
    truncatedS,
  ]);

  return Buffer.concat([paddedR, paddedS]);
};

export const rawToDer = (kryptos: IKryptosEc, rawSignature: Buffer): Buffer => {
  const keySize = KEY_SIZES[kryptos.curve];

  if (rawSignature.length !== 2 * keySize) {
    throw new EcError("Invalid raw signature length");
  }

  const r = rawSignature.subarray(0, keySize);
  const s = rawSignature.subarray(keySize);

  function toDERFormat(value: Buffer): Buffer {
    let pos = 0;
    while (pos < value.length && value[pos] === 0) {
      pos++;
    }
    const subarray = value.subarray(pos);
    if (subarray[0] >= 0x80) {
      return Buffer.concat([Buffer.from([0x02, subarray.length + 1, 0x00]), subarray]);
    } else {
      return Buffer.concat([Buffer.from([0x02, subarray.length]), subarray]);
    }
  }

  const derR = toDERFormat(r);
  const derS = toDERFormat(s);

  const sequenceLength = derR.length + derS.length;
  const lengthByte = sequenceLength < 128 ? [sequenceLength] : [0x81, sequenceLength];

  return Buffer.concat([Buffer.from([0x30, ...lengthByte]), derR, derS]);
};
