import MockDate from "mockdate";
import {
  TEST_RSA_KEY_B64,
  TEST_RSA_KEY_JWK,
  TEST_RSA_KEY_PEM,
} from "../__fixtures__/rsa-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (RSA)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("env", () => {
    test("import", () => {
      const kryptos = KryptosKit.env.import(
        "kryptos:eyJpYXQiOjE3MDQwOTYwMDAsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3MDQwOTYwMDAsInVhdCI6MTcwNDA5NjAwMCwiZSI6IkFRQUIiLCJuIjoiN2N4TEhveGFIZFlVOEVYMmlqNW00MlhJUVlXQlV4S01PZlZiVjJPWDBuTkhFZG9qWGZSZk9OdnJBSHdzdlJxY2RONDR5djFFMWJlMThxczVIUkI2N0QzcUxlUmpYY2plZ2RqV3ZRajY2SUZWWkl4UUhOSi1MWERiQVlzN2dlejhSWWJCT2JuRHpmcnF5OXZJUFpldDF0YnF2bHh2OWFUUjM4eDNPUko0WTZZbTlTdGJLT1VJbzdCTEl2b2MxTTV1TlVJRW5GS0taaGJtVlI0MjMtRjUwd19FMDYxOEtFeFpnZXVyXzhjTXNTV1p4eWwwb2VTSS1ySW9kamZWSmJzaFQxeXk5OHpLUmotbU1ueVBLZ0hRQVJyOVN3REE1WGx0OUwyZlZaNzJ4Z3dhUE9CVWdGb0RUUFFzcVEzUmtqN25ZVVNxd1FWRUwwLW9IMks3VTNPZUdlS3lJUU1OelJkU2ZZTXczZ1NjNWR0d3FYNjRvSzMzbE4yanpUS2EwY2xTWmpxSjRqelVMMVlyWE1kZEYwN2RNUXFqTjJtR2plWlZ5NUxhTzRCNThZNWwta08wMUtkd0EtX0xjRGhrTmdiS2laTVpWdE5QbFZrUjNuQ3ZJbnQ1Y3FQT3FNT2NMVzNvQTF3bWg3emF1V3FvcmtscFNTczc1enc4RVR0ekFUU0p2OGg3a1VHOUJsMVFRZ2RCa0dxS2I0WkctcjVCajZwd0pySFZtZ1BTTW93UDhQOUcxM2lRTEZkS1g3MTRBM0RNS0RjMDNUSnZzMnlWSzgxWVVDdE81YVJkd2IwcTBZY0ZxbjlCSEkzY21PLWtPaFhxdU1ha1BRM3pXX0ZCU25JZUJoSk1PYkNRT21ZRXVaeHJpZk1jQ1FUWTdqNWpzUDk2MmU3WlBuNTNTVGMiLCJkIjoiSzZMRFhoV3ZLNjV2SlRBUmI0akg1STUyMHQ4bXZoRzNQYU55WVhUYkZUa21IM2FCNnVtLTEzWXpoMkZCN0dtSHNFSmU5WkRJSXRlVlFiUjl4SUdUck9vbm9NZzZHNm1TZXcxSlNtTHRkLURUeEtHaXljY3VkRFF6V19NcXRrckFlQm1rTjIySktyRVNpTm9Kd3BPa3lMbWpWYzhzbEV6c1hqN3MyY0l6NlVWQl9OYzU0U1UyRXFOMUJqUVRPbEd2RTRMTHljdXpyY3doOUJpWlJUZmczUVFWd0NvamtGbUNTejd0enYtOXFud1YzZUFUa09tWTRUZjBDTTF5Qlh4elBsYnFXR0p4ODdZV1QwbGdFX3RGS2c3RDBCR1JWQXFXVE1USENqVWpYM0ExR0ZxcDV1dWRrMjl6Q29xSW5HZUNtZXk1MExXZ3IzWFVpZjNhRmhRdlBJSTM5Z2hWWFFlMTVTOXFwQ3VvMk83VUZ3Q2VEUUdjR2FPejdTQjM5NVU3d19JeU9tdFFEWF96Qkc5bHNQbVRTUjFjUEliZEVnZnJuQ3liWlpjalhyRTNQVE1NaTNjS2ZQT3VDaXRrd1U5MWRvZElmWkxNa2t3ZXFLbG1HT0xZSWMtSm1aaF9lUnI3YlRrYWxYaVZ4TVRUSWE2TGlPX3AyMHlXdWtDSnhXLTJSbmtZTjJsZEJuRFUwSDJKaEtRcnNEOC1ZUmNfekJuTEpRMlRNcnc2MmhOd3RWMkREVm9ORDNzSnUwU0NPTVVkSDBLbWZJa3BCUEVaNDNzbUNVTDllMGZHX3EwMDRCYmRtdDhxNHZWOHRyZFlGX256LS0tb3l1YXNlMDljSjdDZi1xbXFOV3FzQWJpNlpOUjA0dFdDUWFyM09ldzEwWnpmWnRuRDNqTi1kWUUiLCJwIjoiLWNoemlmQnE3MXE4bUVUTGZCUWpXaDVrS2tWVWRhYVN1WjAybHlNaHppUjhpWkFzRjBSMDhTRlAyWFdsT0pyUkd2TEJJdHVsNzg3TXVyT0k0VkxoT1NGLXk1Q1p1ZlN4SE8teERzWlRER0QtR3hZV0F1TGNkc2hjU2w0SHlKNFNaczEzdTNGVU5WSmVJTkM2SVk0a244aVdIblBVYlVIdHU0a0t2ZC0wdDZoWXhVQjM2d2JfNGZVam5RbmdoanRTSksyM29lb0FyUTdaREEwaEFwQzNmUEUyZzVvUURrR3FXRGQxU21ybXozWGxBWlRNSzl2cVVsR0haUmhhcUMtZEJocHRMR1NVdWx3cm5jRXFzWUtsVzdOWXBwQVdnSEFZNDB3Unk1WWdscHY5R09odEpmVXFrbTdtUXNtTGhWdy0xR3RHYzdNaThzUDNObi0wM21jcW9RIiwicSI6Ijg3ZDZIMERHdkpOTkxDWmRsZXhwOVE4NFBwWllNTXktNEpqYk9wWmg2cXlodmNsZ1hua3dYazB1bzdHMWRJNWEtLUVnZ2Z0Nl9uUXM4cVEtMmJidEozVjZCQUVDbkVzV1BKZVdtZWlNRkVmMEw1MVAwTU1mX0FZNVk0WE9MQ0U2QTNUaWV1SDROSjBpV01JWnFZa0NFWUlxR1RqUjNUV05rU3pRR0phZXdLcER1MW05NWRaQ0liWEdNWGMwVGc2UUpGMERJUmRwcVNRdzVRQXlMRm1TUVlMdWRqZHM2ODh0ZS1zNjNnMDJXX3hMZVVnS09LZC16c01ZX3hudWJFbFhhRVhWSXRCdGdwYlBvTXF6NkRHcjkydU5UcEtVTzNXYjJzd0lIaG9NS3A1RzdYTlF6U2xzSExuRWp3Yno4bTR4TVhsQ1pEZnhfLXVrSjBpTkZsejgxdyIsImRwIjoicXhZeWxVTzRheFBTWTlXVEx2eTRMaXpzM01zNkM0LTVwaXRaemZIQllPbzY1eHA2S01HNS04T2Vac3VmRElOMlFLZ1B3LW1BNGgzYXV2TG9DYlgwRUdheDY0cXkwTjBhUjBDaUhRV1lzcnpvcl9MVHhzeE94NGw3TlhEc2tldzduSENWMXl6THllNE9EUm9LczVzaDJOUFNoeTg5VEV6QkloZS01TWtLaGxWbjRFdkZGNVZteFFWY2pGN01qQVNyd2ZXLTlzZEtDVDlIU1dyZ3Rsb2JaQmZ3Ql9vSmowcElfRDJZT0EyNjVGVFRNOThRYmVZbXZKV2RVSkI2NEFJazRwNU5Ndl85b3h3b3Y5Z2tmd3VHYWFZUlRaMFozSVZyZHB5T184eG5xLUZTWGJJdHVMY1JudFVaSUp2ZDFjMldOM2IyX1o2d2pHblB0V09KcG1BeG9RIiwiZHEiOiJIUV9wQVNjUlM5Vm80M1hqdlFnSERwRDFEUW1TbEtjbHI5U3FkODhNLUJZRDU0VEctQjBOZG9GUHFYZDhndHlpM3R4V3F3bFlfbFRPTTFVQXBhZVptaFg1S2RjUV82QTRrNXNqLTFCdXU5Qmt2dlRNV3NHWjQ4eS1OUzcwaWZDZ1lWOGp6ckY1anBTYVR1ay1kQ2dCVmlNbWNBR0ZqUkpnd2tvTXVwSGpkbWdYVVpULV94UlFxSUpya3VSN0dUX0ZVb0RBNmNaSDlFSjdqaU02MkcwSjhzUHhPYW1jVkhaTkh6VEt2VVhvRUlvQ1dnRU1MdnRTTk1leENHS0lPdU40QjlnajlWWFRhVG9nb2pUcHhTdF9MUzduRjlLRTJKNUtxb21nQWk3cS1uNExTUzl5R0RUelRtMmNrYzJyYzJKT2ZXN1BTdkljNm42b0FZTTJSODlvMnciLCJxaSI6InBrcGZ2cFlWVUc4RjFveVRLRjBHTUdRZTRpMVZ3SUdRNE00MHJXWlVQNXhKbUgtcl9rRXo3RDgtbENuT1JWc3BRbjFnUHVRZXY2M1VSYUZfMjVCem1Ca3VSdEtYcm13NGJGdkt5c0xxZ20yUFdIOHZCRE9PQS1lZlRVVnR2U2RIbFExYVVZUkxXTjRfMktoV1FfWi1YMHZsWVRHeWp0WVdRakVDdjVDT0FyaWRhdkUyaU1maS12V0plMUxXQjU1cmNtcmJoMmpjMzhlbk1OZEQyU0o5R01RZVRoWmVXNWltQ2xhaDhOQ1Ffd3FNMXFDZ0lWSDIyRXVlU3R3eG40ZG95YlJxWGNqcXZGVXZudkI5ZUF2eG1jWGNEZFZKb3UzYzd6bkIzZnY4WXY5dzNCeE1EUzdaQTRaQW5scFJOejBMTkFydWNscGR6WldoVmEwWmpmWExDUSIsImtpZCI6ImZhNjU5NzgwLTBkNWMtNTY1Yi1hNzZlLWQ4NTQ3N2MyYjAwYiIsImFsZyI6IlJTNTEyIiwidXNlIjoic2lnIiwia3R5IjoiUlNBIn0",
      );

      expect(kryptos.export("b64")).toEqual(TEST_RSA_KEY_B64);
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:eyJlIjoiQVFBQiIsIm4iOiI3Y3hMSG94YUhkWVU4RVgyaWo1bTQyWElRWVdCVXhLTU9mVmJWMk9YMG5OSEVkb2pYZlJmT052ckFId3N2UnFjZE40NHl2MUUxYmUxOHFzNUhSQjY3RDNxTGVSalhjamVnZGpXdlFqNjZJRlZaSXhRSE5KLUxYRGJBWXM3Z2V6OFJZYkJPYm5EemZycXk5dklQWmV0MXRicXZseHY5YVRSMzh4M09SSjRZNlltOVN0YktPVUlvN0JMSXZvYzFNNXVOVUlFbkZLS1poYm1WUjQyMy1GNTB3X0UwNjE4S0V4WmdldXJfOGNNc1NXWnh5bDBvZVNJLXJJb2RqZlZKYnNoVDF5eTk4ektSai1tTW55UEtnSFFBUnI5U3dEQTVYbHQ5TDJmVlo3Mnhnd2FQT0JVZ0ZvRFRQUXNxUTNSa2o3bllVU3F3UVZFTDAtb0gySzdVM09lR2VLeUlRTU56UmRTZllNdzNnU2M1ZHR3cVg2NG9LMzNsTjJqelRLYTBjbFNaanFKNGp6VUwxWXJYTWRkRjA3ZE1RcWpOMm1HamVaVnk1TGFPNEI1OFk1bC1rTzAxS2R3QS1fTGNEaGtOZ2JLaVpNWlZ0TlBsVmtSM25DdkludDVjcVBPcU1PY0xXM29BMXdtaDd6YXVXcW9ya2xwU1NzNzV6dzhFVHR6QVRTSnY4aDdrVUc5QmwxUVFnZEJrR3FLYjRaRy1yNUJqNnB3SnJIVm1nUFNNb3dQOFA5RzEzaVFMRmRLWDcxNEEzRE1LRGMwM1RKdnMyeVZLODFZVUN0TzVhUmR3YjBxMFljRnFuOUJISTNjbU8ta09oWHF1TWFrUFEzeldfRkJTbkllQmhKTU9iQ1FPbVlFdVp4cmlmTWNDUVRZN2o1anNQOTYyZTdaUG41M1NUYyIsImQiOiJLNkxEWGhXdks2NXZKVEFSYjRqSDVJNTIwdDhtdmhHM1BhTnlZWFRiRlRrbUgzYUI2dW0tMTNZemgyRkI3R21Ic0VKZTlaRElJdGVWUWJSOXhJR1RyT29ub01nNkc2bVNldzFKU21MdGQtRFR4S0dpeWNjdWREUXpXX01xdGtyQWVCbWtOMjJKS3JFU2lOb0p3cE9reUxtalZjOHNsRXpzWGo3czJjSXo2VVZCX05jNTRTVTJFcU4xQmpRVE9sR3ZFNExMeWN1enJjd2g5QmlaUlRmZzNRUVZ3Q29qa0ZtQ1N6N3R6di05cW53VjNlQVRrT21ZNFRmMENNMXlCWHh6UGxicVdHSng4N1lXVDBsZ0VfdEZLZzdEMEJHUlZBcVdUTVRIQ2pValgzQTFHRnFwNXV1ZGsyOXpDb3FJbkdlQ21leTUwTFdncjNYVWlmM2FGaFF2UElJMzlnaFZYUWUxNVM5cXBDdW8yTzdVRndDZURRR2NHYU96N1NCMzk1VTd3X0l5T210UURYX3pCRzlsc1BtVFNSMWNQSWJkRWdmcm5DeWJaWmNqWHJFM1BUTU1pM2NLZlBPdUNpdGt3VTkxZG9kSWZaTE1ra3dlcUtsbUdPTFlJYy1KbVpoX2VScjdiVGthbFhpVnhNVFRJYTZMaU9fcDIweVd1a0NKeFctMlJua1lOMmxkQm5EVTBIMkpoS1Fyc0Q4LVlSY196Qm5MSlEyVE1ydzYyaE53dFYyRERWb05EM3NKdTBTQ09NVWRIMEttZklrcEJQRVo0M3NtQ1VMOWUwZkdfcTAwNEJiZG10OHE0dlY4dHJkWUZfbnotLS1veXVhc2UwOWNKN0NmLXFtcU5XcXNBYmk2Wk5SMDR0V0NRYXIzT2V3MTBaemZadG5EM2pOLWRZRSIsInAiOiItY2h6aWZCcTcxcThtRVRMZkJRaldoNWtLa1ZVZGFhU3VaMDJseU1oemlSOGlaQXNGMFIwOFNGUDJYV2xPSnJSR3ZMQkl0dWw3ODdNdXJPSTRWTGhPU0YteTVDWnVmU3hITy14RHNaVERHRC1HeFlXQXVMY2RzaGNTbDRIeUo0U1pzMTN1M0ZVTlZKZUlOQzZJWTRrbjhpV0huUFViVUh0dTRrS3ZkLTB0NmhZeFVCMzZ3Yl80ZlVqblFuZ2hqdFNKSzIzb2VvQXJRN1pEQTBoQXBDM2ZQRTJnNW9RRGtHcVdEZDFTbXJtejNYbEFaVE1LOXZxVWxHSFpSaGFxQy1kQmhwdExHU1V1bHdybmNFcXNZS2xXN05ZcHBBV2dIQVk0MHdSeTVZZ2xwdjlHT2h0SmZVcWttN21Rc21MaFZ3LTFHdEdjN01pOHNQM05uLTAzbWNxb1EiLCJxIjoiODdkNkgwREd2Sk5OTENaZGxleHA5UTg0UHBaWU1NeS00SmpiT3BaaDZxeWh2Y2xnWG5rd1hrMHVvN0cxZEk1YS0tRWdnZnQ2X25RczhxUS0yYmJ0SjNWNkJBRUNuRXNXUEplV21laU1GRWYwTDUxUDBNTWZfQVk1WTRYT0xDRTZBM1RpZXVINE5KMGlXTUlacVlrQ0VZSXFHVGpSM1RXTmtTelFHSmFld0twRHUxbTk1ZFpDSWJYR01YYzBUZzZRSkYwRElSZHBxU1F3NVFBeUxGbVNRWUx1ZGpkczY4OHRlLXM2M2cwMldfeExlVWdLT0tkLXpzTVlfeG51YkVsWGFFWFZJdEJ0Z3BiUG9NcXo2REdyOTJ1TlRwS1VPM1diMnN3SUhob01LcDVHN1hOUXpTbHNITG5FandiejhtNHhNWGxDWkRmeF8tdWtKMGlORmx6ODF3IiwiZHAiOiJxeFl5bFVPNGF4UFNZOVdUTHZ5NExpenMzTXM2QzQtNXBpdFp6ZkhCWU9vNjV4cDZLTUc1LThPZVpzdWZESU4yUUtnUHctbUE0aDNhdXZMb0NiWDBFR2F4NjRxeTBOMGFSMENpSFFXWXNyem9yX0xUeHN4T3g0bDdOWERza2V3N25IQ1YxeXpMeWU0T0RSb0tzNXNoMk5QU2h5ODlURXpCSWhlLTVNa0tobFZuNEV2RkY1Vm14UVZjakY3TWpBU3J3ZlctOXNkS0NUOUhTV3JndGxvYlpCZndCX29KajBwSV9EMllPQTI2NUZUVE05OFFiZVltdkpXZFVKQjY0QUlrNHA1Tk12XzlveHdvdjlna2Z3dUdhYVlSVFowWjNJVnJkcHlPXzh4bnEtRlNYYkl0dUxjUm50VVpJSnZkMWMyV04zYjJfWjZ3akduUHRXT0pwbUF4b1EiLCJkcSI6IkhRX3BBU2NSUzlWbzQzWGp2UWdIRHBEMURRbVNsS2NscjlTcWQ4OE0tQllENTRURy1CME5kb0ZQcVhkOGd0eWkzdHhXcXdsWV9sVE9NMVVBcGFlWm1oWDVLZGNRXzZBNGs1c2otMUJ1dTlCa3Z2VE1Xc0daNDh5LU5TNzBpZkNnWVY4anpyRjVqcFNhVHVrLWRDZ0JWaU1tY0FHRmpSSmd3a29NdXBIamRtZ1hVWlQtX3hSUXFJSnJrdVI3R1RfRlVvREE2Y1pIOUVKN2ppTTYyRzBKOHNQeE9hbWNWSFpOSHpUS3ZVWG9FSW9DV2dFTUx2dFNOTWV4Q0dLSU91TjRCOWdqOVZYVGFUb2dvalRweFN0X0xTN25GOUtFMko1S3FvbWdBaTdxLW40TFNTOXlHRFR6VG0yY2tjMnJjMkpPZlc3UFN2SWM2bjZvQVlNMlI4OW8ydyIsInFpIjoicGtwZnZwWVZVRzhGMW95VEtGMEdNR1FlNGkxVndJR1E0TTQwcldaVVA1eEptSC1yX2tFejdEOC1sQ25PUlZzcFFuMWdQdVFldjYzVVJhRl8yNUJ6bUJrdVJ0S1hybXc0YkZ2S3lzTHFnbTJQV0g4dkJET09BLWVmVFVWdHZTZEhsUTFhVVlSTFdONF8yS2hXUV9aLVgwdmxZVEd5anRZV1FqRUN2NUNPQXJpZGF2RTJpTWZpLXZXSmUxTFdCNTVyY21yYmgyamMzOGVuTU5kRDJTSjlHTVFlVGhaZVc1aW1DbGFoOE5DUV93cU0xcUNnSVZIMjJFdWVTdHd4bjRkb3liUnFYY2pxdkZVdm52QjllQXZ4bWNYY0RkVkpvdTNjN3puQjNmdjhZdjl3M0J4TURTN1pBNFpBbmxwUk56MExOQXJ1Y2xwZHpaV2hWYTBaamZYTENRIiwia2lkIjoiZmE2NTk3ODAtMGQ1Yy01NjViLWE3NmUtZDg1NDc3YzJiMDBiIiwiYWxnIjoiUlM1MTIiLCJ1c2UiOiJzaWciLCJrdHkiOiJSU0EiLCJpYXQiOjE3MDQwOTYwMDAsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3MDQwOTYwMDAsInVhdCI6MTcwNDA5NjAwMH0",
      );
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_RSA_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_RSA_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(false);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(false);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(false);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(true);
    });
  });

  describe("generate", () => {
    test("auto", () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm: "PS384",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "PS384",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.generate.enc.rsa({
        algorithm: "RSA-OAEP-384",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "RSA-OAEP-384",
        encryption: "A256GCM",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.generate.sig.rsa({
        algorithm: "RS256",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });
  });
});
