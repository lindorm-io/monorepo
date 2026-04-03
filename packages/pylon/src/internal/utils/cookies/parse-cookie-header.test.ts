import { parseCookieHeader } from "./parse-cookie-header";

describe("parseCookieHeader", () => {
  test("should resolve", () => {
    expect(
      parseCookieHeader(
        "pylon_session=eyJhbGciOiJFQ0RILUVTIiwiY3JpdCI6WyJhbGciLCJlbmMiLCJlcGsiLCJoa2RmX3NhbHQiXSwiY3R5IjoidGV4dC9wbGFpbiIsImVuYyI6IkEyNTZHQ00iLCJlcGsiOnsiY3J2IjoiWDQ0OCIsImt0eSI6Ik9LUCIsIngiOiJBMk5iQmlqc0dVSF83b1c2OTJJbllPdUlEWjFONUdQSkNRZ1ZzbnVGZGtjLVQ1MFoweWRFb190YTR6UHlEeGxkLW96NzBEbVJrSmcifSwiaGtkZl9zYWx0IjoiRTBlS0N0cnk5Zk1XbFN5QUNKNGFIQT09Iiwia2lkIjoiNTM4MmNhMTUtYjg0OS01NWFlLTkwNGEtOTE5Njc5N2NjYzFiIiwib2lkIjoiMmM0NTRiZWItOWI2Yi00Y2U3LTkwMDEtYzE4ZDhhMzhlYTA2IiwidHlwIjoiSldFIn0..7pg6pypi47K_StCi.fMbk-FpafEM1Z5O4HXawtFz1DVLvLEWdNw2P1cZOmIlM09VteqaJVr-VDbHPaLtgZM9znWxnzNPIOXTpSApLfT2xUckNKglV0ibYB8qEC7_q_tawP7T4kvo4ekQEdArvIEFb74s8iYLM3hp4.-wpdFHmREZZ0r80J7PCVvA; priority=high; pylon_session.sig=YX2HG7xfLoqklyL4yXJQhJy8CJM; priority=high; testOne=dmFsdWVPbmU; testOne.sig=EGWG5m0eCn2p32rJ7erkL4NX4LM; testTwo=dmFsdWVUd28",
      ),
    ).toEqual([
      {
        name: "pylon_session",
        signature: "YX2HG7xfLoqklyL4yXJQhJy8CJM",
        value:
          "eyJhbGciOiJFQ0RILUVTIiwiY3JpdCI6WyJhbGciLCJlbmMiLCJlcGsiLCJoa2RmX3NhbHQiXSwiY3R5IjoidGV4dC9wbGFpbiIsImVuYyI6IkEyNTZHQ00iLCJlcGsiOnsiY3J2IjoiWDQ0OCIsImt0eSI6Ik9LUCIsIngiOiJBMk5iQmlqc0dVSF83b1c2OTJJbllPdUlEWjFONUdQSkNRZ1ZzbnVGZGtjLVQ1MFoweWRFb190YTR6UHlEeGxkLW96NzBEbVJrSmcifSwiaGtkZl9zYWx0IjoiRTBlS0N0cnk5Zk1XbFN5QUNKNGFIQT09Iiwia2lkIjoiNTM4MmNhMTUtYjg0OS01NWFlLTkwNGEtOTE5Njc5N2NjYzFiIiwib2lkIjoiMmM0NTRiZWItOWI2Yi00Y2U3LTkwMDEtYzE4ZDhhMzhlYTA2IiwidHlwIjoiSldFIn0..7pg6pypi47K_StCi.fMbk-FpafEM1Z5O4HXawtFz1DVLvLEWdNw2P1cZOmIlM09VteqaJVr-VDbHPaLtgZM9znWxnzNPIOXTpSApLfT2xUckNKglV0ibYB8qEC7_q_tawP7T4kvo4ekQEdArvIEFb74s8iYLM3hp4.-wpdFHmREZZ0r80J7PCVvA",
      },
      {
        name: "testOne",
        signature: "EGWG5m0eCn2p32rJ7erkL4NX4LM",
        value: "dmFsdWVPbmU",
      },
      {
        name: "testTwo",
        signature: null,
        value: "dmFsdWVUd28",
      },
    ]);
  });
});
