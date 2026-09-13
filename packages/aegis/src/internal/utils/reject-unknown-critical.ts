import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { writtenHeader } from "../header/written-header.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The formats this gate namespaces its refusals by: every {@link TokenFormatTag},
 * plus the DPoP proof — a JOSE door of its own with no `VerifiedToken.format`,
 * since the proof is never the token a verify returns.
 */
type CritFormatTag = TokenFormatTag | "dpop";

/**
 * The `crit` enforcement, for BOTH wires. RFC 7515 §4.1.11, RFC 9052 §3.1.
 *
 * ⭐ ONE GROUND, AND IT IS THE CALLER'S DECLARATION. The duty to understand a
 * critical extension sits on the RECIPIENT, and aegis is never the final
 * recipient — it verifies on an application's behalf, so it can only refuse until
 * the application claims the parameter. `declared` is that claim, and it is EMPTY
 * when the caller states none: fail closed.
 *
 * ⭐⭐ THE READ RULE, STATED ONCE — every other site points here.
 *
 *  a. NO REGISTRY COLUMN CAN ADMIT A MEMBER ON THIS PATH; the registry reads here
 *     only ever REFUSE. `validateCrit` runs FIRST and refuses every
 *     specification-defined name through
 *     `internal/header/is-spec-defined-header-param.ts`.
 *  b. THE CALLER'S DECLARATION IS NECESSARY, NEVER SUFFICIENT. A declared member
 *     is still refused when it is not carried, is empty, is spec-defined, or
 *     rides the COSE bucket the signature does not cover:
 *     `scenarios.ts#a-crit-declaration-does-not-substitute-for-the-parameter-being-carried`,
 *     `#a-crit-declaration-does-not-admit-a-specification-defined-parameter`,
 *     `#a-crit-declaration-does-not-reach-the-unprotected-bucket`.
 *  c. `critEligible` IS THE WRITE SIDE'S COLUMN ALONE —
 *     `internal/header/is-crit-eligible.ts` is its one reader, serving the mint
 *     gate `internal/header/assert-crit-eligible.ts`. Two different questions: may
 *     a PRODUCER name this, versus has the RECIPIENT claimed it.
 *
 * ⇒ "A token aegis mints is a token aegis verifies" holds CONDITIONALLY: it
 * verifies when the verifier declares what the producer marked critical.
 *
 * The two checks below decide which refusal a token gets:
 *
 *  1. MALFORMED — `crit` is not a non-empty array of strings, names an
 *     IANA-registered parameter (`crit` is for extensions only), or names a
 *     parameter the header it was read from does not carry. RFC 9052 §3.1.
 *  2. UNCLAIMED — a well-formed member the caller did not declare, so nothing on
 *     this call has taken responsibility for understanding it. RFC 7515 §4.1.11
 *     on JOSE; on COSE it is aegis deriving the consequence of the same duty.
 *
 * ⚠ THE KEYLESS PARSE NEVER REACHES THIS FUNCTION — `internal/wire/jose-token-wire.ts`
 * and `internal/wire/cose-token-wire.ts` run `validateCrit` alone, because reading
 * a token asserts nothing about UNDERSTANDING it. Both doors still call
 * {@link writtenHeader} first, as this function does; without it a parse refuses a
 * `crit`-carrying token a mint had just produced. ⇒ "aegis refuses an
 * unrecognised crit" is about VERIFY and DECRYPT, never about `aegis.parse`.
 *
 * ⚠ `header` MUST be the INTEGRITY-PROTECTED header, JOSE-named, and `custom` the
 * SAME bucket's params no registry row answers for. On COSE that is the protected
 * bucket alone, with its integer labels already translated back to JOSE names by
 * the read path; on JOSE the single protected header IS that header.
 *
 * ⚠ THE TWO BAGS ARE ONE HEADER. `validateCrit`'s presence rule asks about the
 * header the producer WROTE, which the read side splits in two only because a
 * registered param has a typed home and an unregistered one does not. Asked on
 * `header` alone, every custom critical member reads as "not present in the
 * header" and the write side mints tokens this side refuses.
 */
export const rejectUnknownCritical = ({
  header,
  custom,
  declared,
  format,
  name = format.toUpperCase(),
  remedy = "Name the parameter in the verify or decrypt crit option to accept it.",
  error,
}: {
  header: { crit?: unknown } & Dict;
  /** The same bucket's params no registry row answers for, verbatim. */
  custom: Dict;
  /**
   * The custom parameters the CALLER takes responsibility for — its `crit`
   * verify/decrypt option. `undefined` is "nothing declared", which refuses every
   * custom critical parameter.
   */
  declared: ReadonlyArray<string> | undefined;
  /** The wire format tag, which namespaces the two error codes. */
  format: CritFormatTag;
  /** The family the two titles spell; the tag upper-cased when omitted. */
  name?: string;
  /** The sentence telling the caller where to declare the parameter. */
  remedy?: string;
  error: typeof AegisError;
}): void => {
  // The header as the producer wrote it — see `written-header.ts` for why the two
  // bags have to be rejoined before either rule below can ask about presence.
  const written = writtenHeader(header, custom);

  // A `Set`, never `in` or a plain object — the members compared against it are
  // TOKEN-supplied and a `Set` has no prototype chain, so `crit: ["toString"]` is
  // matched against what the caller actually declared. `in` on a
  // token-influenced key is a BANNED construct in this package.
  const claimed = new Set(declared);

  const malformed = validateCrit(written);
  if (malformed) {
    // ⚠ THE LIST, NOT THE MEMBER: this refusal's `data` is the whole `crit`,
    // while the UNCLAIMED one below carries `data.param`. The MESSAGE names the
    // member in both — `validateCrit` builds this one's.
    throw new error(`Invalid crit header: ${malformed}`, {
      code: `${format}_invalid_crit`,
      // ⚠ `written`, not `header`: the verdict was decided on the header AS
      // WRITTEN, so reporting the typed bag can hand a consumer
      // `{ crit: undefined }` while the message names a member — a foreign COSE
      // token carrying a tstr `"crit"` and no integer label 2 reaches exactly that.
      data: { crit: written.crit },
      title: `${name} Invalid Crit`,
      details:
        "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
    });
  }

  const crit = written.crit;
  if (!isArray(crit)) return;

  // What reaches here is a well-formed extension name the header DOES carry
  // (`validateCrit` refused the rest), so the only question left is whether the
  // caller claimed it — the recipient duty of RFC 7515 §4.1.11, discharged on the
  // application's behalf.
  //
  // ⚠ The FIRST UNCLAIMED member is reported, not `crit[0]`: with a declared
  // extension earlier in the list, naming the first member would report a
  // parameter the caller has already taken on.
  for (const member of crit) {
    if (claimed.has(member as string)) continue;

    throw new error(`Unsupported critical header parameter: ${String(member)}`, {
      code: `${format}_unsupported_crit_param`,
      data: { param: member },
      title: `${name} Unsupported Crit Param`,
      details: `The crit header marks an extension parameter as critical and the caller has not declared it, so nothing in this call has taken responsibility for understanding it and the ${name} must be rejected. ${remedy}`,
    });
  }
};
