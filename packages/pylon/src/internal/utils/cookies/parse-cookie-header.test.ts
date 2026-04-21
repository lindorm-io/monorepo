import { parseCookieHeader } from "./parse-cookie-header";
import { describe, expect, test } from "vitest";

describe("parseCookieHeader", () => {
  test("should parse cookies with sig and kid siblings", () => {
    expect(
      parseCookieHeader(
        "pylon_session=eyJhbGciOiJFQ0RILUVTIiwiY3JpdCI6WyJhbGciLCJlbmMiLCJlcGsiLCJoa2RmX3NhbHQiXSwiY3R5IjoidGV4dC9wbGFpbiIsImVuYyI6IkEyNTZHQ00iLCJlcGsiOnsiY3J2IjoiWDQ0OCIsImt0eSI6Ik9LUCIsIngiOiJBMk5iQmlqc0dVSF83b1c2OTJJbllPdUlEWjFONUdQSkNRZ1ZzbnVGZGtjLVQ1MFoweWRFb190YTR6UHlEeGxkLW96NzBEbVJrSmcifSwiaGtkZl9zYWx0IjoiRTBlS0N0cnk5Zk1XbFN5QUNKNGFIQT09Iiwia2lkIjoiNTM4MmNhMTUtYjg0OS01NWFlLTkwNGEtOTE5Njc5N2NjYzFiIiwib2lkIjoiMmM0NTRiZWItOWI2Yi00Y2U3LTkwMDEtYzE4ZDhhMzhlYTA2IiwidHlwIjoiSldFIn0..7pg6pypi47K_StCi.fMbk-FpafEM1Z5O4HXawtFz1DVLvLEWdNw2P1cZOmIlM09VteqaJVr-VDbHPaLtgZM9znWxnzNPIOXTpSApLfT2xUckNKglV0ibYB8qEC7_q_tawP7T4kvo4ekQEdArvIEFb74s8iYLM3hp4.-wpdFHmREZZ0r80J7PCVvA; priority=high; pylon_session.sig=YX2HG7xfLoqklyL4yXJQhJy8CJM; pylon_session.kid=5382ca15-b849-55ae-904a-9196797ccc1b; priority=high; testOne=dmFsdWVPbmU; testOne.sig=EGWG5m0eCn2p32rJ7erkL4NX4LM; testOne.kid=kid-one; testTwo=dmFsdWVUd28",
      ),
    ).toMatchSnapshot();
  });

  test("should initialize kid as null when only sig is present", () => {
    expect(parseCookieHeader("foo=bar; foo.sig=sigval")).toMatchSnapshot();
  });

  test("should initialize signature as null when only kid is present", () => {
    expect(parseCookieHeader("foo=bar; foo.kid=kidval")).toMatchSnapshot();
  });

  test("should initialize both as null for plain cookies", () => {
    expect(parseCookieHeader("foo=bar")).toMatchSnapshot();
  });
});
