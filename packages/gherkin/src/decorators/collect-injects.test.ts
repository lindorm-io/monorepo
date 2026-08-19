import { describe, expect, test } from "vitest";
import { metadataOf } from "../__fixtures__/test-helpers.js";
import { getOwnMetadata } from "../internal/metadata/own-metadata.js";
import { Inject } from "./Inject.js";
import { collectInjects } from "./collect-injects.js";

class TokenA {}
class TokenB {}
class TokenC {}

describe("collectInjects", () => {
  test("should collect leaf-first through metadata-less intermediates", () => {
    class Grand {
      @Inject(TokenA)
      grand!: TokenA;
    }

    // No decorated members — no own metadata level, silently skipped.
    class PlainMid extends Grand {}

    class Leaf extends PlainMid {
      @Inject(TokenB)
      leaf!: TokenB;
    }

    expect(collectInjects(Leaf, metadataOf(Leaf))).toEqual([
      { fieldName: "leaf", token: TokenB },
      { fieldName: "grand", token: TokenA },
    ]);
  });

  test("should deduplicate by field name with the NEAREST declaration winning", () => {
    class Grand {
      @Inject(TokenA)
      shadowed!: TokenA;

      @Inject(TokenC)
      keep!: TokenC;
    }

    class Leaf extends Grand {
      @Inject(TokenB)
      shadowed: TokenB = undefined!;
    }

    expect(collectInjects(Leaf, metadataOf(Leaf))).toEqual([
      { fieldName: "shadowed", token: TokenB },
      { fieldName: "keep", token: TokenC },
    ]);
  });

  test("should return an empty array for a class with no injects anywhere", () => {
    class Plain {
      @Inject(TokenA)
      only!: TokenA;
    }

    // The leaf's own level is empty and Plain is not an ancestor of Alone.
    class Alone {}

    expect(getOwnMetadata(Alone)).toBeUndefined();
    expect(collectInjects(Alone, {})).toEqual([]);
    expect(collectInjects(Plain, metadataOf(Plain))).toEqual([
      { fieldName: "only", token: TokenA },
    ]);
  });
});
