import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { writtenHeader } from "../header/written-header.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The `crit` enforcement, for BOTH wires.
 *
 * ⚠ THE TWO WIRES DO NOT SAY THE SAME THING. They agree on the DUTY and differ on
 * whether a consequence is written down:
 *
 * - RFC 7515 §4.1.11 states it outright: *"If any of the listed extension Header
 *   Parameters are not understood and supported by the recipient, then the JWS
 *   is invalid."*
 * - RFC 9052 §3.1 states the duty with NO consequence attached: `crit` indicates
 *   *"which protected header parameters an application that is processing a
 *   message is required to understand"*. Its one fatal-error clause is quoted
 *   under bullet 1 below and belongs to a DIFFERENT condition. So the COSE
 *   refusal for a not-understood member is aegis deriving the obvious
 *   consequence — a processor required to understand a parameter, and unable to,
 *   cannot claim to have processed the message — not a quotable mandate.
 *
 * ⭐ ONE GROUND, AND IT IS THE CALLER'S DECLARATION. RFC 7515 §4.1.11 puts the
 * duty to understand a critical extension on the RECIPIENT, and aegis is never
 * the final recipient: it verifies on an application's behalf, so it cannot
 * discharge the duty itself and can only refuse until the application claims the
 * parameter. `declared` is that claim, and it is EMPTY when the caller states
 * none — fail closed.
 *
 * ⭐⭐ THE READ RULE, STATED ONCE — every other site points here.
 *
 *  a. NO REGISTRY COLUMN CAN ADMIT A MEMBER ON THIS PATH; the registry reads
 *     here only ever REFUSE. `validateCrit` runs FIRST and refuses every
 *     SPECIFICATION-DEFINED name through `isSpecDefinedHeaderParam`, which reads
 *     the registry's `spec` column
 *     (`internal/header/is-spec-defined-header-param.ts`).
 *  b. THE CALLER'S DECLARATION IS NECESSARY, NEVER SUFFICIENT. Among the members
 *     that survive `validateCrit` — well-formed, carried, non-empty, not
 *     spec-defined — admission requires the caller to have named the member,
 *     `oid` included. A DECLARED member is still refused when it fails any of
 *     those, and when it rides the COSE bucket the signature does not cover:
 *     `scenarios.ts#a-crit-declaration-does-not-substitute-for-the-parameter-being-carried`,
 *     `#a-crit-declaration-does-not-admit-a-specification-defined-parameter`,
 *     `#a-crit-declaration-does-not-reach-the-unprotected-bucket`.
 *  c. `critEligible` IS THE WRITE SIDE'S COLUMN ALONE —
 *     `internal/header/is-crit-eligible.ts` is its one reader, serving the mint
 *     gate `internal/header/assert-crit-eligible.ts`. That aegis REGISTERS a
 *     parameter says nothing about whether the application behind it can act on
 *     one, which is why this gate does not share a predicate with that one: may
 *     a PRODUCER name this, versus has the RECIPIENT claimed it.
 *
 * ⇒ "A token aegis mints is a token aegis verifies" holds CONDITIONALLY, and the
 * condition is the point: it verifies when the verifier declares what the
 * producer marked critical.
 *
 * The two checks below decide which refusal a token gets:
 *
 *  1. MALFORMED — `crit` is not a non-empty array of strings, names an
 *     IANA-registered parameter (`crit` is for extensions only), or names a
 *     parameter that is not in the header it was read from. RFC 9052 §3.1 calls
 *     the last one out explicitly, and THIS is the sentence with the fatal-error
 *     clause — note the antecedent, which is the misplaced label and nothing
 *     else: *"If the 'crit' value list includes a label for which the header
 *     parameter is not in the protected-header-parameters bucket, this is a
 *     fatal error in processing the message."* ⛔ Do not lift this quote to
 *     bullet 2; it does not cover a not-understood member.
 *  2. UNCLAIMED — a well-formed member the caller did not declare, so nothing on
 *     this call has taken responsibility for understanding it. Mandated by RFC
 *     7515 §4.1.11 on JOSE; DERIVED on COSE, per the note above. No §3.1 sentence
 *     says this.
 *
 * ⚠ THE KEYLESS PARSE NEVER REACHES THIS FUNCTION — `internal/wire/jose-token-wire.ts`
 * and `internal/wire/cose-token-wire.ts` run `validateCrit` alone. That is correct
 * in itself (reading a token asserts nothing about UNDERSTANDING it), but
 * `validateCrit` still has to be handed the header AS WRITTEN: it asks whether the
 * header carries what its `crit` names, and the read side splits the registered
 * parameters from the unregistered ones. Both doors therefore call
 * {@link writtenHeader} first, exactly as this function does — without it a parse
 * refuses a `crit`-carrying token a mint had just produced.
 * ⇒ "aegis refuses an unrecognised crit" is a statement about
 * VERIFY and DECRYPT, never about `aegis.parse`.
 *
 * ⚠ `header` MUST be the INTEGRITY-PROTECTED header, JOSE-named, and `custom`
 * the SAME bucket's params no registry row answers for. On COSE that is the protected bucket
 * alone (the unprotected one carries no crit — the writer refuses to put one
 * there) and the integer labels are already translated back to their JOSE names
 * by the read path, which is what lets one implementation serve both wires. On
 * JOSE the single protected header IS that header.
 *
 * ⚠ THE TWO BAGS ARE ONE HEADER. `validateCrit`'s presence rule (RFC 9052 §3.1's
 * fatal error above) asks a question about the header the producer WROTE, which
 * the read side splits in two only because a registered param has a typed home
 * and an unregistered one does not. Asked on `header` alone, every custom member
 * a conformant producer marked critical reads as "not present in the header" —
 * the write side would mint a token this side refuses for the wrong reason.
 */
export const rejectUnknownCritical = ({
  header,
  custom,
  declared,
  format,
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
  format: TokenFormatTag;
  error: typeof AegisError;
}): void => {
  const name = format.toUpperCase();

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

  // `validateCrit` has refused an empty array, a non-string member, an
  // IANA-registered name (`internal/header/is-spec-defined-header-param.ts`), and
  // a member the header does not carry or carries empty. What reaches here is a
  // well-formed extension name the header DOES carry, and the only question left
  // is whether the caller claimed it — RFC 7515 §4.1.11's recipient duty, *"If
  // any of the listed extension Header Parameters are not understood and
  // supported by the recipient, then the JWS is invalid"*, enforced on the
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
      details: `The crit header marks an extension parameter as critical and the caller has not declared it, so nothing in this call has taken responsibility for understanding it and the ${name} must be rejected. Name the parameter in the verify or decrypt crit option to accept it.`,
    });
  }
};
