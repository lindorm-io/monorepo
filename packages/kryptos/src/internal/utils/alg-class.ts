import { KryptosError } from "../../errors/index.js";
import type { KryptosAlgClass, KryptosType } from "../../types/index.js";

// The class of the KEY MATERIAL, derived from its type — `oct` is the only
// symmetric type; everything else is a keypair.
//
// The switch is EXHAUSTIVE ON PURPOSE. A sixth key type must not fall through to
// a default that quietly calls it asymmetric — it must fail loudly here, in the
// one place the rule lives, so that whoever adds it makes the classification an
// explicit decision. That is the entire point of deriving the class centrally
// instead of letting every consumer re-write `type: { $nin: ["oct"] }`.
export const calculateAlgClass = (type: KryptosType): KryptosAlgClass => {
  switch (type) {
    case "AKP":
    case "EC":
    case "OKP":
    case "RSA":
      return "asymmetric";

    case "oct":
      return "symmetric";

    default:
      throw new KryptosError(`Unsupported key type: ${type as string}`, {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type "${type as string}" has no known algorithm class; classify it in calculateAlgClass before use.`,
        data: { type },
      });
  }
};
