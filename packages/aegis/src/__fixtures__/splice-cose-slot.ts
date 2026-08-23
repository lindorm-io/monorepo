import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";

/**
 * Re-encode a minted COSE token with ONE slot of its structure array replaced —
 * the FOREIGN-producer injector for the slot-type gates (`requireBstr`).
 *
 * ⚠ Aegis cannot mint a token with a non-bstr slot: `signCwt`/`CwsKit.sign`/
 * `CweKit.encrypt` write `Buffer`s, so a token exercising a slot-type refusal has
 * to be rewritten after minting. Both COSE tag layers are preserved (aegis wraps
 * its signed tokens in the CWT tag 61), so the spliced token reaches the same
 * opening the original does.
 */
export const spliceCoseSlot = (token: Buffer, slot: number, value: unknown): Buffer => {
  const outer = decodeCbor<unknown>(token);
  const inner = outer instanceof Tag ? outer.contents : outer;
  const structure = inner instanceof Tag ? inner.contents : inner;

  const contents = (structure as Array<unknown>).slice();
  contents[slot] = value;

  const rewrappedInner = inner instanceof Tag ? new Tag(inner.tag, contents) : contents;

  return encodeCbor(
    outer instanceof Tag ? new Tag(outer.tag, rewrappedInner) : rewrappedInner,
  );
};
