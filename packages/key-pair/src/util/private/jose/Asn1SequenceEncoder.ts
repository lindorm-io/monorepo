// https://github.com/panva/jose

const tagInteger = 0x02;
const tagBitStr = 0x03;
const tagOctStr = 0x04;
const tagSequence = 0x30;

const bZero = Buffer.from([0x00]);
const bTagInteger = Buffer.from([tagInteger]);
const bTagBitStr = Buffer.from([tagBitStr]);
const bTagSequence = Buffer.from([tagSequence]);
const bTagOctStr = Buffer.from([tagOctStr]);

const encodeLength = (len: number): any => {
  if (len < 128) return Buffer.from([len]);
  const buffer = Buffer.alloc(5);
  buffer.writeUInt32BE(len, 1);
  let offset = 1;
  while (buffer[offset] === 0) offset++;
  buffer[offset - 1] = 0x80 | (5 - offset);
  return buffer.slice(offset - 1);
};

const oids = new Map<string, Buffer>([
  ["P-256", Buffer.from("06 08 2A 86 48 CE 3D 03 01 07".replace(/ /g, ""), "hex")],
  ["P-384", Buffer.from("06 05 2B 81 04 00 22".replace(/ /g, ""), "hex")],
  ["P-521", Buffer.from("06 05 2B 81 04 00 23".replace(/ /g, ""), "hex")],
  ["ecPublicKey", Buffer.from("06 07 2A 86 48 CE 3D 02 01".replace(/ /g, ""), "hex")],
]);

export class Asn1SequenceEncoder {
  private length: number;
  private readonly elements: Buffer[];

  public constructor() {
    this.length = 0;
    this.elements = [];
  }

  public oidFor(oid: string): void {
    const bOid = oids.get(oid);
    if (!bOid) {
      throw new Error("unsupported or invalid OID");
    }
    this.elements.push(bOid);
    this.length += bOid.length;
  }

  public zero(): void {
    this.elements.push(bTagInteger, Buffer.from([0x01]), bZero);
    this.length += 3;
  }

  public one(): void {
    this.elements.push(bTagInteger, Buffer.from([0x01]), Buffer.from([0x01]));
    this.length += 3;
  }

  public unsignedInteger(integer: Buffer): void {
    if (integer[0] & 0x80) {
      const len = encodeLength(integer.length + 1);
      this.elements.push(bTagInteger, len, bZero, integer);
      this.length += 2 + len.length + integer.length;
    } else {
      let i = 0;
      while (integer[i] === 0 && (integer[i + 1] & 0x80) === 0) i++;

      const len = encodeLength(integer.length - i);
      this.elements.push(bTagInteger, encodeLength(integer.length - i), integer.slice(i));
      this.length += 1 + len.length + integer.length - i;
    }
  }

  public octStr(octStr: Buffer): void {
    const len = encodeLength(octStr.length);
    this.elements.push(bTagOctStr, encodeLength(octStr.length), octStr);
    this.length += 1 + len.length + octStr.length;
  }

  public bitStr(bitS: Buffer): void {
    const len = encodeLength(bitS.length + 1);
    this.elements.push(bTagBitStr, encodeLength(bitS.length + 1), bZero, bitS);
    this.length += 1 + len.length + bitS.length + 1;
  }

  public add(seq: Buffer): void {
    this.elements.push(seq);
    this.length += seq.length;
  }

  public end(tag = bTagSequence): Buffer {
    const len = encodeLength(this.length);
    return Buffer.concat([tag, len, ...this.elements], 1 + len.length + this.length);
  }
}
