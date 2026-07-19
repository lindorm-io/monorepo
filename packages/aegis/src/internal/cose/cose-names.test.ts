import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { specByCose, specByCoseName } from "../claims/registry.js";
import { coseToJoseNames, joseToCoseNames } from "./cose-names.js";

describe("cose-names — JOSE ↔ COSE string-name bridge", () => {
  test("joseToCoseNames renames the divergences (jti → cti), passes the rest through", () => {
    const jose: Dict = {
      iss: "https://i/",
      exp: 1704099600,
      jti: "the-jti",
      scope: ["read"],
      acme_flag: true, // unregistered → verbatim
    };

    expect(joseToCoseNames(jose)).toEqual({
      iss: "https://i/",
      exp: 1704099600,
      cti: "the-jti", // ONLY renamed pair
      scope: ["read"],
      acme_flag: true,
    });
  });

  test("coseToJoseNames renames back (cti → jti), passes the rest through", () => {
    const cose: Dict = {
      iss: "https://i/",
      cti: "the-jti",
      acme_flag: true,
    };

    expect(coseToJoseNames(cose)).toEqual({
      iss: "https://i/",
      jti: "the-jti",
      acme_flag: true,
    });
  });

  test("the bridge is a pure name rename — values are never touched", () => {
    const jose: Dict = { jti: "x", exp: new Date(0), custom_obj: { a: 1 } };
    const round = coseToJoseNames(joseToCoseNames(jose));
    expect(round).toEqual(jose);
  });

  test("registry COSE lookups resolve by integer label and by COSE name", () => {
    expect(specByCose(7)?.domain).toBe("tokenId"); // cti label
    expect(specByCose(1)?.jose).toBe("iss");
    expect(specByCoseName("cti")?.jose).toBe("jti"); // divergent name
    expect(specByCoseName("iss")?.domain).toBe("issuer"); // name == jose
    expect(specByCoseName("jti")).toBeUndefined(); // jti is the JOSE name, not the COSE name
  });
});
