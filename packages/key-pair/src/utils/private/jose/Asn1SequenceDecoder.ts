// https://github.com/panva/jose

const tagInteger = 0x02;
const tagSequence = 0x30;

export class Asn1SequenceDecoder {
  private readonly buffer: Buffer;
  private offset: number;

  public constructor(buffer: Buffer) {
    if (buffer[0] !== tagSequence) {
      throw new TypeError();
    }

    this.buffer = buffer;
    this.offset = 1;

    const len = this.decodeLength();
    if (len !== buffer.length - this.offset) {
      throw new TypeError();
    }
  }

  public decodeLength(): number {
    let length = this.buffer[this.offset++];
    if (length & 0x80) {
      // Long form.
      const nBytes = length & ~0x80;
      length = 0;
      for (let i = 0; i < nBytes; i++) length = (length << 8) | this.buffer[this.offset + i];
      this.offset += nBytes;
    }
    return length;
  }

  public unsignedInteger(): Buffer {
    if (this.buffer[this.offset++] !== tagInteger) {
      throw new TypeError();
    }

    let length = this.decodeLength();

    // There may be exactly one leading zero (if the next byte's MSB is set).
    if (this.buffer[this.offset] === 0) {
      this.offset++;
      length--;
    }

    const result = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  public end(): void {
    if (this.offset !== this.buffer.length) {
      throw new TypeError();
    }
  }
}
