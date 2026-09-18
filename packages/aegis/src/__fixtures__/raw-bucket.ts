import { isNumber } from "@lindorm/is";
import type { TokenInspection } from "./inspect-token.js";

export type Wire = "jose" | "cose";

/** A JOSE member name, or a COSE label — the wire's own vocabulary, never a domain name. */
export type WireKey = string | number;

export type RawPart = "protectedHeader" | "unprotectedHeader" | "payload";

/**
 * One raw wire bucket as `inspect-token.ts` read it off the bytes.
 *
 * A JOSE object has no integer keys, so an integer label asked of a JOSE bucket
 * is absent whatever the token says — an exclusion over it could never fail.
 * The lookup refuses the question instead of answering it.
 */
export class RawBucket {
  public constructor(
    public readonly wire: Wire,
    private readonly entries: ReadonlyMap<WireKey, unknown>,
  ) {}

  public has(key: WireKey): boolean {
    this.assertExpressible(key);
    return this.entries.has(key);
  }

  public get(key: WireKey): unknown {
    this.assertExpressible(key);
    return this.entries.get(key);
  }

  private assertExpressible(key: WireKey): void {
    if (this.wire === "cose" || isNumber(key) === false) return;

    throw new Error(
      `a JOSE bucket carries no integer label ${key}; name the JOSE member instead`,
    );
  }
}

/**
 * The bucket a part names, or a thrown reason. A part that is not there to read
 * — a JOSE unprotected bucket, a JWE's ciphertext — is never an empty bucket:
 * every inclusion and exclusion passes over an empty container.
 */
export const rawBucketOf = (inspection: TokenInspection, part: RawPart): RawBucket => {
  if (inspection.wire === "jose") {
    switch (part) {
      case "protectedHeader":
        return new RawBucket("jose", new Map(Object.entries(inspection.protectedHeader)));

      case "unprotectedHeader":
        throw new Error("a JOSE compact serialisation carries no unprotected bucket");

      case "payload":
        if (inspection.payload.readable === false) {
          throw new Error(
            `the JOSE payload cannot be read: ${inspection.payload.reason}`,
          );
        }
        return new RawBucket("jose", new Map(Object.entries(inspection.payload.value)));

      default: {
        const exhaustive: never = part;
        throw new Error(`unhandled wire part ${String(exhaustive)}`);
      }
    }
  }

  switch (part) {
    case "protectedHeader":
      return new RawBucket("cose", inspection.protectedHeader);

    case "unprotectedHeader":
      return new RawBucket("cose", inspection.unprotectedHeader);

    case "payload":
      if (inspection.payload.readable === false) {
        throw new Error(`the COSE payload cannot be read: ${inspection.payload.reason}`);
      }
      return new RawBucket("cose", inspection.payload.value);

    default: {
      const exhaustive: never = part;
      throw new Error(`unhandled wire part ${String(exhaustive)}`);
    }
  }
};
