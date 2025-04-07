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
        "kryptos:eyJpYXQiOjE3MDQwOTYwMDAsImtleV9vcHMiOlsic2lnbiIsInZlcmlmeSJdLCJuYmYiOjE3MDQwOTYwMDAsInVhdCI6MTcwNDA5NjAwMCwiZSI6IkFRQUIiLCJuIjoiN2N4TEhveGFIZFlVOEVYMmlqNW00MlhJUVlXQlV4S01PZlZiVjJPWDBuTkhFZG9qWGZSZk9OdnJBSHdzdlJxY2RONDR5djFFMWJlMThxczVIUkI2N0QzcUxlUmpYY2plZ2RqV3ZRajY2SUZWWkl4UUhOSi1MWERiQVlzN2dlejhSWWJCT2JuRHpmcnF5OXZJUFpldDF0YnF2bHh2OWFUUjM4eDNPUko0WTZZbTlTdGJLT1VJbzdCTEl2b2MxTTV1TlVJRW5GS0taaGJtVlI0MjMtRjUwd19FMDYxOEtFeFpnZXVyXzhjTXNTV1p4eWwwb2VTSS1ySW9kamZWSmJzaFQxeXk5OHpLUmotbU1ueVBLZ0hRQVJyOVN3REE1WGx0OUwyZlZaNzJ4Z3dhUE9CVWdGb0RUUFFzcVEzUmtqN25ZVVNxd1FWRUwwLW9IMks3VTNPZUdlS3lJUU1OelJkU2ZZTXczZ1NjNWR0d3FYNjRvSzMzbE4yanpUS2EwY2xTWmpxSjRqelVMMVlyWE1kZEYwN2RNUXFqTjJtR2plWlZ5NUxhTzRCNThZNWwta08wMUtkd0EtX0xjRGhrTmdiS2laTVpWdE5QbFZrUjNuQ3ZJbnQ1Y3FQT3FNT2NMVzNvQTF3bWg3emF1V3FvcmtscFNTczc1enc4RVR0ekFUU0p2OGg3a1VHOUJsMVFRZ2RCa0dxS2I0WkctcjVCajZwd0pySFZtZ1BTTW93UDhQOUcxM2lRTEZkS1g3MTRBM0RNS0RjMDNUSnZzMnlWSzgxWVVDdE81YVJkd2IwcTBZY0ZxbjlCSEkzY21PLWtPaFhxdU1ha1BRM3pXX0ZCU25JZUJoSk1PYkNRT21ZRXVaeHJpZk1jQ1FUWTdqNWpzUDk2MmU3WlBuNTNTVGMiLCJkIjoiSzZMRFhoV3ZLNjV2SlRBUmI0akg1STUyMHQ4bXZoRzNQYU55WVhUYkZUa21IM2FCNnVtLTEzWXpoMkZCN0dtSHNFSmU5WkRJSXRlVlFiUjl4SUdUck9vbm9NZzZHNm1TZXcxSlNtTHRkLURUeEtHaXljY3VkRFF6V19NcXRrckFlQm1rTjIySktyRVNpTm9Kd3BPa3lMbWpWYzhzbEV6c1hqN3MyY0l6NlVWQl9OYzU0U1UyRXFOMUJqUVRPbEd2RTRMTHljdXpyY3doOUJpWlJUZmczUVFWd0NvamtGbUNTejd0enYtOXFud1YzZUFUa09tWTRUZjBDTTF5Qlh4elBsYnFXR0p4ODdZV1QwbGdFX3RGS2c3RDBCR1JWQXFXVE1USENqVWpYM0ExR0ZxcDV1dWRrMjl6Q29xSW5HZUNtZXk1MExXZ3IzWFVpZjNhRmhRdlBJSTM5Z2hWWFFlMTVTOXFwQ3VvMk83VUZ3Q2VEUUdjR2FPejdTQjM5NVU3d19JeU9tdFFEWF96Qkc5bHNQbVRTUjFjUEliZEVnZnJuQ3liWlpjalhyRTNQVE1NaTNjS2ZQT3VDaXRrd1U5MWRvZElmWkxNa2t3ZXFLbG1HT0xZSWMtSm1aaF9lUnI3YlRrYWxYaVZ4TVRUSWE2TGlPX3AyMHlXdWtDSnhXLTJSbmtZTjJsZEJuRFUwSDJKaEtRcnNEOC1ZUmNfekJuTEpRMlRNcnc2MmhOd3RWMkREVm9ORDNzSnUwU0NPTVVkSDBLbWZJa3BCUEVaNDNzbUNVTDllMGZHX3EwMDRCYmRtdDhxNHZWOHRyZFlGX256LS0tb3l1YXNlMDljSjdDZi1xbXFOV3FzQWJpNlpOUjA0dFdDUWFyM09ldzEwWnpmWnRuRDNqTi1kWUUiLCJwIjoiLWNoemlmQnE3MXE4bUVUTGZCUWpXaDVrS2tWVWRhYVN1WjAybHlNaHppUjhpWkFzRjBSMDhTRlAyWFdsT0pyUkd2TEJJdHVsNzg3TXVyT0k0VkxoT1NGLXk1Q1p1ZlN4SE8teERzWlRER0QtR3hZV0F1TGNkc2hjU2w0SHlKNFNaczEzdTNGVU5WSmVJTkM2SVk0a244aVdIblBVYlVIdHU0a0t2ZC0wdDZoWXhVQjM2d2JfNGZVam5RbmdoanRTSksyM29lb0FyUTdaREEwaEFwQzNmUEUyZzVvUURrR3FXRGQxU21ybXozWGxBWlRNSzl2cVVsR0haUmhhcUMtZEJocHRMR1NVdWx3cm5jRXFzWUtsVzdOWXBwQVdnSEFZNDB3Unk1WWdscHY5R09odEpmVXFrbTdtUXNtTGhWdy0xR3RHYzdNaThzUDNObi0wM21jcW9RIiwicSI6Ijg3ZDZIMERHdkpOTkxDWmRsZXhwOVE4NFBwWllNTXktNEpqYk9wWmg2cXlodmNsZ1hua3dYazB1bzdHMWRJNWEtLUVnZ2Z0Nl9uUXM4cVEtMmJidEozVjZCQUVDbkVzV1BKZVdtZWlNRkVmMEw1MVAwTU1mX0FZNVk0WE9MQ0U2QTNUaWV1SDROSjBpV01JWnFZa0NFWUlxR1RqUjNUV05rU3pRR0phZXdLcER1MW05NWRaQ0liWEdNWGMwVGc2UUpGMERJUmRwcVNRdzVRQXlMRm1TUVlMdWRqZHM2ODh0ZS1zNjNnMDJXX3hMZVVnS09LZC16c01ZX3hudWJFbFhhRVhWSXRCdGdwYlBvTXF6NkRHcjkydU5UcEtVTzNXYjJzd0lIaG9NS3A1RzdYTlF6U2xzSExuRWp3Yno4bTR4TVhsQ1pEZnhfLXVrSjBpTkZsejgxdyIsImRwIjoicXhZeWxVTzRheFBTWTlXVEx2eTRMaXpzM01zNkM0LTVwaXRaemZIQllPbzY1eHA2S01HNS04T2Vac3VmRElOMlFLZ1B3LW1BNGgzYXV2TG9DYlgwRUdheDY0cXkwTjBhUjBDaUhRV1lzcnpvcl9MVHhzeE94NGw3TlhEc2tldzduSENWMXl6THllNE9EUm9LczVzaDJOUFNoeTg5VEV6QkloZS01TWtLaGxWbjRFdkZGNVZteFFWY2pGN01qQVNyd2ZXLTlzZEtDVDlIU1dyZ3Rsb2JaQmZ3Ql9vSmowcElfRDJZT0EyNjVGVFRNOThRYmVZbXZKV2RVSkI2NEFJazRwNU5Ndl85b3h3b3Y5Z2tmd3VHYWFZUlRaMFozSVZyZHB5T184eG5xLUZTWGJJdHVMY1JudFVaSUp2ZDFjMldOM2IyX1o2d2pHblB0V09KcG1BeG9RIiwiZHEiOiJIUV9wQVNjUlM5Vm80M1hqdlFnSERwRDFEUW1TbEtjbHI5U3FkODhNLUJZRDU0VEctQjBOZG9GUHFYZDhndHlpM3R4V3F3bFlfbFRPTTFVQXBhZVptaFg1S2RjUV82QTRrNXNqLTFCdXU5Qmt2dlRNV3NHWjQ4eS1OUzcwaWZDZ1lWOGp6ckY1anBTYVR1ay1kQ2dCVmlNbWNBR0ZqUkpnd2tvTXVwSGpkbWdYVVpULV94UlFxSUpya3VSN0dUX0ZVb0RBNmNaSDlFSjdqaU02MkcwSjhzUHhPYW1jVkhaTkh6VEt2VVhvRUlvQ1dnRU1MdnRTTk1leENHS0lPdU40QjlnajlWWFRhVG9nb2pUcHhTdF9MUzduRjlLRTJKNUtxb21nQWk3cS1uNExTUzl5R0RUelRtMmNrYzJyYzJKT2ZXN1BTdkljNm42b0FZTTJSODlvMnciLCJxaSI6InBrcGZ2cFlWVUc4RjFveVRLRjBHTUdRZTRpMVZ3SUdRNE00MHJXWlVQNXhKbUgtcl9rRXo3RDgtbENuT1JWc3BRbjFnUHVRZXY2M1VSYUZfMjVCem1Ca3VSdEtYcm13NGJGdkt5c0xxZ20yUFdIOHZCRE9PQS1lZlRVVnR2U2RIbFExYVVZUkxXTjRfMktoV1FfWi1YMHZsWVRHeWp0WVdRakVDdjVDT0FyaWRhdkUyaU1maS12V0plMUxXQjU1cmNtcmJoMmpjMzhlbk1OZEQyU0o5R01RZVRoWmVXNWltQ2xhaDhOQ1Ffd3FNMXFDZ0lWSDIyRXVlU3R3eG40ZG95YlJxWGNqcXZGVXZudkI5ZUF2eG1jWGNEZFZKb3UzYzd6bkIzZnY4WXY5dzNCeE1EUzdaQTRaQW5scFJOejBMTkFydWNscGR6WldoVmEwWmpmWExDUSIsImtpZCI6ImZhNjU5NzgwLTBkNWMtNTY1Yi1hNzZlLWQ4NTQ3N2MyYjAwYiIsImFsZyI6IlJTNTEyIiwidXNlIjoic2lnIiwia3R5IjoiUlNBIn0",
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
