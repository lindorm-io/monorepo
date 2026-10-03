import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import { isSpecDefinedHeaderParam } from "./is-spec-defined-header-param.js";

/**
 * The refusal for a key in a header bag that no registry row spells under EITHER
 * tier's vocabulary — the closed-set verdict both write tiers give:
 * `mapTokenHeader` at the domain crossing (`internal/utils/token-header.ts`) and
 * `buildJoseHeader` at a JOSE wire door (`build-jose-header.ts`). A name a
 * specification defines is refused as not emittable, any other as unknown.
 *
 * ⚠ Both callers have ruled out a registry row under either spelling before they
 * call this, so {@link isSpecDefinedHeaderParam} answers from its unimplemented set
 * alone.
 */
export const unregisteredHeaderParameter = ({
  parameter,
  error,
  remedy,
  debug,
}: {
  parameter: string;
  /** The tier's class: `AegisDomainError` at the crossing, the kit's own at a wire door. */
  error: typeof AegisError;
  /** The repair an unknown name's message offers, at a door that has one to offer. */
  remedy?: string;
  debug?: Dict;
}): AegisError => {
  if (isSpecDefinedHeaderParam(parameter)) {
    return new error(
      `Header parameter "${parameter}" is defined by a specification, and aegis does not implement it, so it cannot be emitted`,
      {
        code: "header_not_emittable",
        data: { parameter },
        debug,
        title: "Header Not Emittable",
        details:
          "A public specification defines this header parameter and aegis implements none of what it means, so no header bag writes it and the custom bag refuses it too. A recipient would give it the meaning its specification assigns while nothing here honoured it, and dropping it would produce a token without a parameter the caller stated.",
      },
    );
  }

  return new error(
    remedy === undefined
      ? `Header parameter "${parameter}" is not a header parameter aegis writes`
      : `Header parameter "${parameter}" is not a header parameter aegis writes; ${remedy}`,
    {
      code: "header_unknown_parameter",
      data: { parameter },
      debug,
      title: "Header Unknown Parameter",
      details:
        "A header bag takes a closed set of header parameters, the ones aegis's header registry defines, and this name is none of them under either vocabulary. Dropping it would produce a token without a parameter the caller stated. A caller's own extension parameter rides the custom bag of a wire namespace or kit; `aegis.sign`, `aegis.encrypt` and `aegis.mint` take none.",
    },
  );
};
