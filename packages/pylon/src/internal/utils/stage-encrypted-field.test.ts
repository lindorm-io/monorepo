// The KEK selector pylon stages onto a bare `@Encrypted()` column must reach
// proteus WHOLE. `PylonColumnEncKey` and `ProteusEncryptionKey` are the same
// `{ kryptos?, condition? }` descriptor, so the mapping is total by
// construction — but it is written out member by member, which is exactly the
// shape that silently dropped the AEAD while the cookie and column paths shared
// one type. These tests pin totality itself, not the two members it has today:
// add a member to `PylonColumnEncKey` without mapping it and they go red.

import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { IProteusSource } from "@lindorm/proteus";
import { Encrypted } from "@lindorm/proteus";
import { describe, expect, test } from "vitest";
import type { PylonColumnEncKey } from "../../types/index.js";
import { stageEncryptedField } from "./stage-encrypted-field.js";

class Target {
  secret!: string;
}

type Staged = {
  entity: Function;
  field: string;
  decorator: Function;
  options: any;
};

/** A source that records what was staged on it and nothing else — the mapping
 *  is what is under test, not proteus's staging registry (covered there). */
const createCapturingSource = (): { source: IProteusSource; staged: Array<Staged> } => {
  const staged: Array<Staged> = [];

  const source = {
    stageFieldDecorator: (
      entity: Function,
      field: string,
      decorator: Function,
      options: any,
    ) => {
      staged.push({ entity, field, decorator, options });
    },
  } as unknown as IProteusSource;

  return { source, staged };
};

const kek = (): IKryptos =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    publish: false,
    purpose: "pylon:kek",
  });

/** Every own member of the selector reaches the staged options with the same
 *  value — the assertion that makes the mapping TOTAL rather than "the two
 *  members someone remembered". */
const expectTotal = (key: PylonColumnEncKey, options: any): void => {
  for (const [member, value] of Object.entries(key)) {
    expect(options).toHaveProperty(member, value);
  }
};

describe("stageEncryptedField", () => {
  test("stages `Encrypted` on the named entity field", async () => {
    const { source, staged } = createCapturingSource();

    await stageEncryptedField(source, Target, "secret", {
      condition: { purpose: "pylon:kek" },
    });

    expect(staged).toHaveLength(1);
    expect(staged[0]!.entity).toBe(Target);
    expect(staged[0]!.field).toBe("secret");
    expect(staged[0]!.decorator).toBe(Encrypted);
  });

  test("passes a condition-only selector through whole", async () => {
    const { source, staged } = createCapturingSource();
    const key: PylonColumnEncKey = {
      condition: { purpose: "pylon:kek", publish: false },
    };

    await stageEncryptedField(source, Target, "secret", key);

    expectTotal(key, staged[0]!.options);
    expect(staged[0]!.options).toEqual({
      kryptos: undefined,
      condition: { purpose: "pylon:kek", publish: false },
    });
  });

  test("passes an injected-key selector through whole", async () => {
    const { source, staged } = createCapturingSource();
    const kryptos = kek();
    const key: PylonColumnEncKey = { kryptos };

    await stageEncryptedField(source, Target, "secret", key);

    expectTotal(key, staged[0]!.options);
    expect(staged[0]!.options.kryptos).toBe(kryptos);
  });

  test("passes both members through whole", async () => {
    const { source, staged } = createCapturingSource();
    const kryptos = kek();
    const key: PylonColumnEncKey = {
      kryptos,
      condition: { algorithm: "A128KW", purpose: "pylon:kek" },
    };

    await stageEncryptedField(source, Target, "secret", key);

    expectTotal(key, staged[0]!.options);
  });

  // The regression this split exists for: the staged options carry the
  // SELECTOR and nothing beyond it. An AEAD reaching here would mean pylon had
  // accepted a cipher choice it cannot honour — proteus owns the cipher on the
  // KEK path — which is precisely what `PylonColumnEncKey` now makes
  // unexpressible.
  test("stages the selector and nothing beyond it", async () => {
    const { source, staged } = createCapturingSource();

    await stageEncryptedField(source, Target, "secret", {
      condition: { purpose: "pylon:kek" },
    });

    expect(Object.keys(staged[0]!.options).sort()).toEqual(["condition", "kryptos"]);
  });
});
