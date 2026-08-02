import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { BackchannelTokenDeliveryMode } from "../enums/BackchannelTokenDeliveryMode.js";
import { backchannelTokenDeliveryModeSchema } from "./backchannel-token-delivery-mode.js";

describe("backchannelTokenDeliveryModeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(
      Object.values(BackchannelTokenDeliveryMode).map((v) =>
        backchannelTokenDeliveryModeSchema.parse(v),
      ),
    ).toEqual(Object.values(BackchannelTokenDeliveryMode));
  });

  test("should reject an unlisted value", () => {
    expect(backchannelTokenDeliveryModeSchema.safeParse("stream")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof backchannelTokenDeliveryModeSchema> =
      BackchannelTokenDeliveryMode.Poll;
    const exported: BackchannelTokenDeliveryMode = inferred;
    const roundTrip: z.infer<typeof backchannelTokenDeliveryModeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
