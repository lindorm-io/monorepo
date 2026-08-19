import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import {
  ABSTRACT_STEPS_BRAND,
  BINDING_BRAND,
  CONTEXT_BRAND,
} from "../internal/metadata/symbols.js";
import type { AbstractConstructor } from "../types/abstract-constructor.js";

type BrandDecorator = "AbstractSteps" | "Binding" | "Context";

const BRANDS: Array<{ brand: symbol; decorator: BrandDecorator }> = [
  { brand: ABSTRACT_STEPS_BRAND, decorator: "AbstractSteps" },
  { brand: BINDING_BRAND, decorator: "Binding" },
  { brand: CONTEXT_BRAND, decorator: "Context" },
];

/**
 * `@AbstractSteps`, `@Binding` and `@Context` are mutually exclusive on one
 * class — each claims the whole class for a different role (marked base,
 * step host, state token). A dedicated code rather than the `duplicate_*`
 * family: those mean ONE decorator applied twice (fix: remove the extra),
 * where this is two DIFFERENT roles claiming one class (fix: split the
 * class). Pinned: assert-no-conflicting-brand.test.ts.
 */
export const assertNoConflictingBrand = (
  target: AbstractConstructor,
  decorator: BrandDecorator,
): void => {
  const conflict = BRANDS.find(
    (entry) => entry.decorator !== decorator && Object.hasOwn(target, entry.brand),
  );

  if (isUndefined(conflict)) {
    return;
  }

  throw new GherkinError(
    `@${decorator} class ${target.name} is already decorated @${conflict.decorator}`,
    {
      code: "conflicting_decorators",
      title: "Conflicting Decorators",
      details:
        "A class carries ONE gherkin role — @AbstractSteps marks a shared base, @Binding hosts steps and hooks, @Context is a state token. Split the class, or remove one of the decorators.",
      data: {
        className: target.name,
        conflicting: conflict.decorator,
        decorator,
      },
    },
  );
};
