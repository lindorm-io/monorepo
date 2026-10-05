import { CoseError } from "../../errors/index.js";
import type { ClaimCodec, ClaimMemberSpec } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";

/**
 * The COSE value codecs a REGISTERED label map carries (RFC 8747 §3.1): a COSE_Key
 * under label 1 and a byte string under label 3. A CLOSED union, so the member
 * codec switches in `cose-key.ts` keep a `never` default.
 */
type RegisteredCodec = { kind: "coseKey" } | { kind: "bstr"; encoding: "utf8" };

/**
 * One member of a registered label map: the name the translator spells it by, the
 * label it rides under, and the COSE value codec applied to it.
 */
export type RegisteredLabel = { name: string; label: number; codec: RegisteredCodec };

/**
 * The registered codec a member's COSE codec resolves to, or `undefined` where a
 * registered label map has no value form for it — exhaustive over
 * {@link ClaimCodec}, so a new kind has to say whether such a map carries it.
 */
const registeredCodecOf = (codec: ClaimCodec): RegisteredCodec | undefined => {
  switch (codec.kind) {
    case "coseKey":
      return { kind: "coseKey" };
    case "bstr":
      switch (codec.encoding) {
        case "utf8":
          return { kind: "bstr", encoding: "utf8" };
        case "b64u":
          return undefined;
        default: {
          const exhaustive: never = codec.encoding;
          throw new CoseError("Unhandled CWT byte-string encoding", {
            code: "cose_unhandled_bstr_encoding",
            data: { encoding: String(exhaustive) },
            title: "Unhandled CWT Byte-String Encoding",
            details:
              "The claim registry declares a byte-string encoding the registered label shaper has no value form for.",
          });
        }
      }
    case "text":
    case "int":
    case "date":
    case "bool":
    case "jwk":
    case "array":
    case "object":
    case "bespoke":
      return undefined;
    default: {
      const exhaustive: never = codec;
      throw new CoseError("Unhandled CWT claim codec kind", {
        code: "cose_unhandled_codec_kind",
        data: { kind: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled CWT Claim Codec Kind",
        details:
          "The claim registry declares a codec kind the registered label shaper does not know, so it cannot say whether a registered label map carries it.",
      });
    }
  }
};

/**
 * The registered label table of a structure's members, in declaration order — what
 * `encodeCnf` / `decodeCnf` (`cose-key.ts`) write and read.
 *
 * A member `absent` on COSE has no entry: the byte layer refuses a PRESENT one by
 * name (`cose_cnf_unsupported`), and the structure walker keys it by its JOSE name
 * on the way there (`internal/claims/claims-registry.ts`, `memberNameOf`). A member
 * keyed by a text NAME has no place in a label map, and a labelled member whose
 * COSE codec the map has no value form for cannot be written — both are refused
 * at construction, so a registry declaring one fails at import rather than on a
 * signed wire.
 *
 * ⭐ A READER OF A MEMBER'S PER-WIRE CODEC: {@link codecFor} resolves the
 * COSE codec, so a member's `per.cose` is what decides its value form here.
 */
export const registeredLabelsOf = (
  claim: string,
  members: ReadonlyArray<ClaimMemberSpec>,
): ReadonlyArray<RegisteredLabel> =>
  members.flatMap((member): Array<RegisteredLabel> => {
    const cose = member.wire.cose;

    switch (cose.kind) {
      case "absent":
        return [];
      case "name":
        throw new CoseError("Registered label map member has no label", {
          code: "cose_registered_member_unsupported",
          data: { claim, member: member.domain },
          title: "Registered Label Map Member Unsupported",
          details:
            "The claim registry declares a structure whose members ride a registered COSE label map, but one of them is keyed by a text name on COSE; a registered label map carries integer labels alone, so the member has no place in it.",
        });
      case "label": {
        const codec = registeredCodecOf(codecFor(member, "cose"));

        if (codec === undefined) {
          throw new CoseError("Registered label map member has no COSE value form", {
            code: "cose_registered_member_unsupported",
            data: { claim, member: member.domain },
            title: "Registered Label Map Member Unsupported",
            details:
              "The claim registry declares a structure whose members ride a registered COSE label map, but one of them carries a COSE codec the map has no value form for; only a COSE_Key and a UTF-8 byte string can be written under a registered label.",
          });
        }

        return [{ name: cose.name, label: cose.label, codec }];
      }
      default: {
        const exhaustive: never = cose;
        throw new CoseError("Unhandled wire key kind", {
          code: "cose_unhandled_wire_key",
          data: {
            claim,
            member: member.domain,
            kind: String((exhaustive as { kind?: unknown }).kind),
          },
          title: "Unhandled Wire Key Kind",
          details:
            "The claim registry declares a wire key kind the registered label shaper does not know.",
        });
      }
    }
  });
