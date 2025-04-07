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
        "kryptos:ZmE2NTk3ODAtMGQ1Yy01NjViLWE3NmUtZDg1NDc3YzJiMDBiLlJTNTEyLi4uc2lnbix2ZXJpZnkuTUlJSktRSUJBQUtDQWdFQTdjeExIb3hhSGRZVThFWDJpajVtNDJYSVFZV0JVeEtNT2ZWYlYyT1gwbk5IRWRvalhmUmZPTnZyQUh3c3ZScWNkTjQ0eXYxRTFiZTE4cXM1SFJCNjdEM3FMZVJqWGNqZWdkald2UWo2NklGVlpJeFFITkotTFhEYkFZczdnZXo4UlliQk9ibkR6ZnJxeTl2SVBaZXQxdGJxdmx4djlhVFIzOHgzT1JKNFk2WW05U3RiS09VSW83QkxJdm9jMU01dU5VSUVuRktLWmhibVZSNDIzLUY1MHdfRTA2MThLRXhaZ2V1cl84Y01zU1daeHlsMG9lU0ktcklvZGpmVkpic2hUMXl5OTh6S1JqLW1NbnlQS2dIUUFScjlTd0RBNVhsdDlMMmZWWjcyeGd3YVBPQlVnRm9EVFBRc3FRM1JrajduWVVTcXdRVkVMMC1vSDJLN1UzT2VHZUt5SVFNTnpSZFNmWU13M2dTYzVkdHdxWDY0b0szM2xOMmp6VEthMGNsU1pqcUo0anpVTDFZclhNZGRGMDdkTVFxak4ybUdqZVpWeTVMYU80QjU4WTVsLWtPMDFLZHdBLV9MY0Roa05nYktpWk1aVnROUGxWa1IzbkN2SW50NWNxUE9xTU9jTFczb0Exd21oN3phdVdxb3JrbHBTU3M3NXp3OEVUdHpBVFNKdjhoN2tVRzlCbDFRUWdkQmtHcUtiNFpHLXI1Qmo2cHdKckhWbWdQU01vd1A4UDlHMTNpUUxGZEtYNzE0QTNETUtEYzAzVEp2czJ5Vks4MVlVQ3RPNWFSZHdiMHEwWWNGcW45QkhJM2NtTy1rT2hYcXVNYWtQUTN6V19GQlNuSWVCaEpNT2JDUU9tWUV1WnhyaWZNY0NRVFk3ajVqc1A5NjJlN1pQbjUzU1RjQ0F3RUFBUUtDQWdBcm9zTmVGYThycm04bE1CRnZpTWZram5iUzN5YS1FYmM5bzNKaGROc1ZPU1lmZG9IcTZiN1hkak9IWVVIc2FZZXdRbDcxa01naTE1VkJ0SDNFZ1pPczZpZWd5RG9icVpKN0RVbEtZdTEzNE5QRW9hTEp4eTUwTkROYjh5cTJTc0I0R2FRM2JZa3FzUktJMmduQ2s2VEl1YU5Wenl5VVRPeGVQdXpad2pQcFJVSDgxem5oSlRZU28zVUdOQk02VWE4VGdzdkp5N090ekNIMEdKbEZOLURkQkJYQUtpT1FXWUpMUHUzT183MnFmQlhkNEJPUTZaamhOX1FJelhJRmZITS1WdXBZWW5IenRoWlBTV0FULTBVcURzUFFFWkZVQ3BaTXhNY0tOU05mY0RVWVdxbm02NTJUYjNNS2lvaWNaNEtaN0xuUXRhQ3ZkZFNKX2RvV0ZDODhnamYyQ0ZWZEI3WGxMMnFrSzZqWTd0UVhBSjROQVp3Wm83UHRJSGYzbFR2RDhqSTZhMUFOZl9NRWIyV3ctWk5KSFZ3OGh0MFNCLXVjTEp0bGx5TmVzVGM5TXd5TGR3cDg4NjRLSzJUQlQzVjJoMGg5a3N5U1RCNm9xV1lZNHRnaHo0bVptSDk1R3Z0dE9ScVZlSlhFeE5NaHJvdUk3LW5iVEphNlFJbkZiN1pHZVJnM2FWMEdjTlRRZlltRXBDdXdQejVoRnpfTUdjc2xEWk15dkRyYUUzQzFYWU1OV2cwUGV3bTdSSUk0eFIwZlFxWjhpU2tFOFJuamV5WUpRdjE3UjhiLXJUVGdGdDJhM3lyaTlYeTJ0MWdYLWZQNzc2aks1cXg3VDF3bnNKXzZxYW8xYXF3QnVMcGsxSFRpMVlKQnF2YzU3RFhSbk45bTJjUGVNMzUxZ1FLQ0FRRUEtY2h6aWZCcTcxcThtRVRMZkJRaldoNWtLa1ZVZGFhU3VaMDJseU1oemlSOGlaQXNGMFIwOFNGUDJYV2xPSnJSR3ZMQkl0dWw3ODdNdXJPSTRWTGhPU0YteTVDWnVmU3hITy14RHNaVERHRC1HeFlXQXVMY2RzaGNTbDRIeUo0U1pzMTN1M0ZVTlZKZUlOQzZJWTRrbjhpV0huUFViVUh0dTRrS3ZkLTB0NmhZeFVCMzZ3Yl80ZlVqblFuZ2hqdFNKSzIzb2VvQXJRN1pEQTBoQXBDM2ZQRTJnNW9RRGtHcVdEZDFTbXJtejNYbEFaVE1LOXZxVWxHSFpSaGFxQy1kQmhwdExHU1V1bHdybmNFcXNZS2xXN05ZcHBBV2dIQVk0MHdSeTVZZ2xwdjlHT2h0SmZVcWttN21Rc21MaFZ3LTFHdEdjN01pOHNQM05uLTAzbWNxb1FLQ0FRRUE4N2Q2SDBER3ZKTk5MQ1pkbGV4cDlRODRQcFpZTU15LTRKamJPcFpoNnF5aHZjbGdYbmt3WGswdW83RzFkSTVhLS1FZ2dmdDZfblFzOHFRLTJiYnRKM1Y2QkFFQ25Fc1dQSmVXbWVpTUZFZjBMNTFQME1NZl9BWTVZNFhPTENFNkEzVGlldUg0TkowaVdNSVpxWWtDRVlJcUdUalIzVFdOa1N6UUdKYWV3S3BEdTFtOTVkWkNJYlhHTVhjMFRnNlFKRjBESVJkcHFTUXc1UUF5TEZtU1FZTHVkamRzNjg4dGUtczYzZzAyV194TGVVZ0tPS2QtenNNWV94bnViRWxYYUVYVkl0QnRncGJQb01xejZER3I5MnVOVHBLVU8zV2Iyc3dJSGhvTUtwNUc3WE5RelNsc0hMbkVqd2J6OG00eE1YbENaRGZ4Xy11a0owaU5GbHo4MXdLQ0FRRUFxeFl5bFVPNGF4UFNZOVdUTHZ5NExpenMzTXM2QzQtNXBpdFp6ZkhCWU9vNjV4cDZLTUc1LThPZVpzdWZESU4yUUtnUHctbUE0aDNhdXZMb0NiWDBFR2F4NjRxeTBOMGFSMENpSFFXWXNyem9yX0xUeHN4T3g0bDdOWERza2V3N25IQ1YxeXpMeWU0T0RSb0tzNXNoMk5QU2h5ODlURXpCSWhlLTVNa0tobFZuNEV2RkY1Vm14UVZjakY3TWpBU3J3ZlctOXNkS0NUOUhTV3JndGxvYlpCZndCX29KajBwSV9EMllPQTI2NUZUVE05OFFiZVltdkpXZFVKQjY0QUlrNHA1Tk12XzlveHdvdjlna2Z3dUdhYVlSVFowWjNJVnJkcHlPXzh4bnEtRlNYYkl0dUxjUm50VVpJSnZkMWMyV04zYjJfWjZ3akduUHRXT0pwbUF4b1FLQ0FRQWRELWtCSnhGTDFXampkZU85Q0FjT2tQVU5DWktVcHlXdjFLcDN6d3o0RmdQbmhNYjRIUTEyZ1UtcGQzeUMzS0xlM0ZhckNWai1WTTR6VlFDbHA1bWFGZmtwMXhEX29EaVRteVA3VUc2NzBHUy05TXhhd1puanpMNDFMdlNKOEtCaFh5UE9zWG1PbEpwTzZUNTBLQUZXSXlad0FZV05FbURDU2d5NmtlTjJhQmRSbFA3X0ZGQ29nbXVTNUhzWlA4VlNnTURweGtmMFFudU9JenJZYlFueXdfRTVxWnhVZGswZk5NcTlSZWdRaWdKYUFRd3UtMUkweDdFSVlvZzY0M2dIMkNQMVZkTnBPaUNpTk9uRkszOHRMdWNYMG9UWW5rcXFpYUFDTHVyNmZndEpMM0lZTlBOT2JaeVJ6YXR6WWs1OWJzOUs4aHpxZnFnQmd6Wkh6MmpiQW9JQkFRQ21TbC0tbGhWUWJ3WFdqSk1vWFFZd1pCN2lMVlhBZ1pEZ3pqU3RabFFfbkVtWWY2di1RVFBzUHo2VUtjNUZXeWxDZldBLTVCNl9yZFJGb1hfYmtIT1lHUzVHMHBldWJEaHNXOHJLd3VxQ2JZOVlmeThFTTQ0RDU1OU5SVzI5SjBlVkRWcFJoRXRZM2pfWXFGWkQ5bjVmUy1WaE1iS08xaFpDTVFLX2tJNEN1SjFxOFRhSXgtTDY5WWw3VXRZSG5tdHlhdHVIYU56Zng2Y3cxMFBaSW4wWXhCNU9GbDVibUtZS1ZxSHcwSkRfQ296V29LQWhVZmJZUzU1SzNER2ZoMmpKdEdwZHlPcThWUy1lOEgxNENfR1p4ZHdOMVVtaTdkenZPY0hkLV94aV8zRGNIRXdOTHRrRGhrQ2VXbEUzUFFzMEN1NXlXbDNObGFGVnJSbU45Y3NKLk1JSUNDZ0tDQWdFQTdjeExIb3hhSGRZVThFWDJpajVtNDJYSVFZV0JVeEtNT2ZWYlYyT1gwbk5IRWRvalhmUmZPTnZyQUh3c3ZScWNkTjQ0eXYxRTFiZTE4cXM1SFJCNjdEM3FMZVJqWGNqZWdkald2UWo2NklGVlpJeFFITkotTFhEYkFZczdnZXo4UlliQk9ibkR6ZnJxeTl2SVBaZXQxdGJxdmx4djlhVFIzOHgzT1JKNFk2WW05U3RiS09VSW83QkxJdm9jMU01dU5VSUVuRktLWmhibVZSNDIzLUY1MHdfRTA2MThLRXhaZ2V1cl84Y01zU1daeHlsMG9lU0ktcklvZGpmVkpic2hUMXl5OTh6S1JqLW1NbnlQS2dIUUFScjlTd0RBNVhsdDlMMmZWWjcyeGd3YVBPQlVnRm9EVFBRc3FRM1JrajduWVVTcXdRVkVMMC1vSDJLN1UzT2VHZUt5SVFNTnpSZFNmWU13M2dTYzVkdHdxWDY0b0szM2xOMmp6VEthMGNsU1pqcUo0anpVTDFZclhNZGRGMDdkTVFxak4ybUdqZVpWeTVMYU80QjU4WTVsLWtPMDFLZHdBLV9MY0Roa05nYktpWk1aVnROUGxWa1IzbkN2SW50NWNxUE9xTU9jTFczb0Exd21oN3phdVdxb3JrbHBTU3M3NXp3OEVUdHpBVFNKdjhoN2tVRzlCbDFRUWdkQmtHcUtiNFpHLXI1Qmo2cHdKckhWbWdQU01vd1A4UDlHMTNpUUxGZEtYNzE0QTNETUtEYzAzVEp2czJ5Vks4MVlVQ3RPNWFSZHdiMHEwWWNGcW45QkhJM2NtTy1rT2hYcXVNYWtQUTN6V19GQlNuSWVCaEpNT2JDUU9tWUV1WnhyaWZNY0NRVFk3ajVqc1A5NjJlN1pQbjUzU1RjQ0F3RUFBUS4uUlNBLnNpZw",
      );

      expect(kryptos.export("b64")).toEqual(TEST_RSA_KEY_B64);
    });

    test("export", () => {
      const kryptos = KryptosKit.from.auto(TEST_RSA_KEY_B64);

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:ZmE2NTk3ODAtMGQ1Yy01NjViLWE3NmUtZDg1NDc3YzJiMDBiLlJTNTEyLi4uc2lnbix2ZXJpZnkuTUlJSktRSUJBQUtDQWdFQTdjeExIb3hhSGRZVThFWDJpajVtNDJYSVFZV0JVeEtNT2ZWYlYyT1gwbk5IRWRvalhmUmZPTnZyQUh3c3ZScWNkTjQ0eXYxRTFiZTE4cXM1SFJCNjdEM3FMZVJqWGNqZWdkald2UWo2NklGVlpJeFFITkotTFhEYkFZczdnZXo4UlliQk9ibkR6ZnJxeTl2SVBaZXQxdGJxdmx4djlhVFIzOHgzT1JKNFk2WW05U3RiS09VSW83QkxJdm9jMU01dU5VSUVuRktLWmhibVZSNDIzLUY1MHdfRTA2MThLRXhaZ2V1cl84Y01zU1daeHlsMG9lU0ktcklvZGpmVkpic2hUMXl5OTh6S1JqLW1NbnlQS2dIUUFScjlTd0RBNVhsdDlMMmZWWjcyeGd3YVBPQlVnRm9EVFBRc3FRM1JrajduWVVTcXdRVkVMMC1vSDJLN1UzT2VHZUt5SVFNTnpSZFNmWU13M2dTYzVkdHdxWDY0b0szM2xOMmp6VEthMGNsU1pqcUo0anpVTDFZclhNZGRGMDdkTVFxak4ybUdqZVpWeTVMYU80QjU4WTVsLWtPMDFLZHdBLV9MY0Roa05nYktpWk1aVnROUGxWa1IzbkN2SW50NWNxUE9xTU9jTFczb0Exd21oN3phdVdxb3JrbHBTU3M3NXp3OEVUdHpBVFNKdjhoN2tVRzlCbDFRUWdkQmtHcUtiNFpHLXI1Qmo2cHdKckhWbWdQU01vd1A4UDlHMTNpUUxGZEtYNzE0QTNETUtEYzAzVEp2czJ5Vks4MVlVQ3RPNWFSZHdiMHEwWWNGcW45QkhJM2NtTy1rT2hYcXVNYWtQUTN6V19GQlNuSWVCaEpNT2JDUU9tWUV1WnhyaWZNY0NRVFk3ajVqc1A5NjJlN1pQbjUzU1RjQ0F3RUFBUUtDQWdBcm9zTmVGYThycm04bE1CRnZpTWZram5iUzN5YS1FYmM5bzNKaGROc1ZPU1lmZG9IcTZiN1hkak9IWVVIc2FZZXdRbDcxa01naTE1VkJ0SDNFZ1pPczZpZWd5RG9icVpKN0RVbEtZdTEzNE5QRW9hTEp4eTUwTkROYjh5cTJTc0I0R2FRM2JZa3FzUktJMmduQ2s2VEl1YU5Wenl5VVRPeGVQdXpad2pQcFJVSDgxem5oSlRZU28zVUdOQk02VWE4VGdzdkp5N090ekNIMEdKbEZOLURkQkJYQUtpT1FXWUpMUHUzT183MnFmQlhkNEJPUTZaamhOX1FJelhJRmZITS1WdXBZWW5IenRoWlBTV0FULTBVcURzUFFFWkZVQ3BaTXhNY0tOU05mY0RVWVdxbm02NTJUYjNNS2lvaWNaNEtaN0xuUXRhQ3ZkZFNKX2RvV0ZDODhnamYyQ0ZWZEI3WGxMMnFrSzZqWTd0UVhBSjROQVp3Wm83UHRJSGYzbFR2RDhqSTZhMUFOZl9NRWIyV3ctWk5KSFZ3OGh0MFNCLXVjTEp0bGx5TmVzVGM5TXd5TGR3cDg4NjRLSzJUQlQzVjJoMGg5a3N5U1RCNm9xV1lZNHRnaHo0bVptSDk1R3Z0dE9ScVZlSlhFeE5NaHJvdUk3LW5iVEphNlFJbkZiN1pHZVJnM2FWMEdjTlRRZlltRXBDdXdQejVoRnpfTUdjc2xEWk15dkRyYUUzQzFYWU1OV2cwUGV3bTdSSUk0eFIwZlFxWjhpU2tFOFJuamV5WUpRdjE3UjhiLXJUVGdGdDJhM3lyaTlYeTJ0MWdYLWZQNzc2aks1cXg3VDF3bnNKXzZxYW8xYXF3QnVMcGsxSFRpMVlKQnF2YzU3RFhSbk45bTJjUGVNMzUxZ1FLQ0FRRUEtY2h6aWZCcTcxcThtRVRMZkJRaldoNWtLa1ZVZGFhU3VaMDJseU1oemlSOGlaQXNGMFIwOFNGUDJYV2xPSnJSR3ZMQkl0dWw3ODdNdXJPSTRWTGhPU0YteTVDWnVmU3hITy14RHNaVERHRC1HeFlXQXVMY2RzaGNTbDRIeUo0U1pzMTN1M0ZVTlZKZUlOQzZJWTRrbjhpV0huUFViVUh0dTRrS3ZkLTB0NmhZeFVCMzZ3Yl80ZlVqblFuZ2hqdFNKSzIzb2VvQXJRN1pEQTBoQXBDM2ZQRTJnNW9RRGtHcVdEZDFTbXJtejNYbEFaVE1LOXZxVWxHSFpSaGFxQy1kQmhwdExHU1V1bHdybmNFcXNZS2xXN05ZcHBBV2dIQVk0MHdSeTVZZ2xwdjlHT2h0SmZVcWttN21Rc21MaFZ3LTFHdEdjN01pOHNQM05uLTAzbWNxb1FLQ0FRRUE4N2Q2SDBER3ZKTk5MQ1pkbGV4cDlRODRQcFpZTU15LTRKamJPcFpoNnF5aHZjbGdYbmt3WGswdW83RzFkSTVhLS1FZ2dmdDZfblFzOHFRLTJiYnRKM1Y2QkFFQ25Fc1dQSmVXbWVpTUZFZjBMNTFQME1NZl9BWTVZNFhPTENFNkEzVGlldUg0TkowaVdNSVpxWWtDRVlJcUdUalIzVFdOa1N6UUdKYWV3S3BEdTFtOTVkWkNJYlhHTVhjMFRnNlFKRjBESVJkcHFTUXc1UUF5TEZtU1FZTHVkamRzNjg4dGUtczYzZzAyV194TGVVZ0tPS2QtenNNWV94bnViRWxYYUVYVkl0QnRncGJQb01xejZER3I5MnVOVHBLVU8zV2Iyc3dJSGhvTUtwNUc3WE5RelNsc0hMbkVqd2J6OG00eE1YbENaRGZ4Xy11a0owaU5GbHo4MXdLQ0FRRUFxeFl5bFVPNGF4UFNZOVdUTHZ5NExpenMzTXM2QzQtNXBpdFp6ZkhCWU9vNjV4cDZLTUc1LThPZVpzdWZESU4yUUtnUHctbUE0aDNhdXZMb0NiWDBFR2F4NjRxeTBOMGFSMENpSFFXWXNyem9yX0xUeHN4T3g0bDdOWERza2V3N25IQ1YxeXpMeWU0T0RSb0tzNXNoMk5QU2h5ODlURXpCSWhlLTVNa0tobFZuNEV2RkY1Vm14UVZjakY3TWpBU3J3ZlctOXNkS0NUOUhTV3JndGxvYlpCZndCX29KajBwSV9EMllPQTI2NUZUVE05OFFiZVltdkpXZFVKQjY0QUlrNHA1Tk12XzlveHdvdjlna2Z3dUdhYVlSVFowWjNJVnJkcHlPXzh4bnEtRlNYYkl0dUxjUm50VVpJSnZkMWMyV04zYjJfWjZ3akduUHRXT0pwbUF4b1FLQ0FRQWRELWtCSnhGTDFXampkZU85Q0FjT2tQVU5DWktVcHlXdjFLcDN6d3o0RmdQbmhNYjRIUTEyZ1UtcGQzeUMzS0xlM0ZhckNWai1WTTR6VlFDbHA1bWFGZmtwMXhEX29EaVRteVA3VUc2NzBHUy05TXhhd1puanpMNDFMdlNKOEtCaFh5UE9zWG1PbEpwTzZUNTBLQUZXSXlad0FZV05FbURDU2d5NmtlTjJhQmRSbFA3X0ZGQ29nbXVTNUhzWlA4VlNnTURweGtmMFFudU9JenJZYlFueXdfRTVxWnhVZGswZk5NcTlSZWdRaWdKYUFRd3UtMUkweDdFSVlvZzY0M2dIMkNQMVZkTnBPaUNpTk9uRkszOHRMdWNYMG9UWW5rcXFpYUFDTHVyNmZndEpMM0lZTlBOT2JaeVJ6YXR6WWs1OWJzOUs4aHpxZnFnQmd6Wkh6MmpiQW9JQkFRQ21TbC0tbGhWUWJ3WFdqSk1vWFFZd1pCN2lMVlhBZ1pEZ3pqU3RabFFfbkVtWWY2di1RVFBzUHo2VUtjNUZXeWxDZldBLTVCNl9yZFJGb1hfYmtIT1lHUzVHMHBldWJEaHNXOHJLd3VxQ2JZOVlmeThFTTQ0RDU1OU5SVzI5SjBlVkRWcFJoRXRZM2pfWXFGWkQ5bjVmUy1WaE1iS08xaFpDTVFLX2tJNEN1SjFxOFRhSXgtTDY5WWw3VXRZSG5tdHlhdHVIYU56Zng2Y3cxMFBaSW4wWXhCNU9GbDVibUtZS1ZxSHcwSkRfQ296V29LQWhVZmJZUzU1SzNER2ZoMmpKdEdwZHlPcThWUy1lOEgxNENfR1p4ZHdOMVVtaTdkenZPY0hkLV94aV8zRGNIRXdOTHRrRGhrQ2VXbEUzUFFzMEN1NXlXbDNObGFGVnJSbU45Y3NKLk1JSUNDZ0tDQWdFQTdjeExIb3hhSGRZVThFWDJpajVtNDJYSVFZV0JVeEtNT2ZWYlYyT1gwbk5IRWRvalhmUmZPTnZyQUh3c3ZScWNkTjQ0eXYxRTFiZTE4cXM1SFJCNjdEM3FMZVJqWGNqZWdkald2UWo2NklGVlpJeFFITkotTFhEYkFZczdnZXo4UlliQk9ibkR6ZnJxeTl2SVBaZXQxdGJxdmx4djlhVFIzOHgzT1JKNFk2WW05U3RiS09VSW83QkxJdm9jMU01dU5VSUVuRktLWmhibVZSNDIzLUY1MHdfRTA2MThLRXhaZ2V1cl84Y01zU1daeHlsMG9lU0ktcklvZGpmVkpic2hUMXl5OTh6S1JqLW1NbnlQS2dIUUFScjlTd0RBNVhsdDlMMmZWWjcyeGd3YVBPQlVnRm9EVFBRc3FRM1JrajduWVVTcXdRVkVMMC1vSDJLN1UzT2VHZUt5SVFNTnpSZFNmWU13M2dTYzVkdHdxWDY0b0szM2xOMmp6VEthMGNsU1pqcUo0anpVTDFZclhNZGRGMDdkTVFxak4ybUdqZVpWeTVMYU80QjU4WTVsLWtPMDFLZHdBLV9MY0Roa05nYktpWk1aVnROUGxWa1IzbkN2SW50NWNxUE9xTU9jTFczb0Exd21oN3phdVdxb3JrbHBTU3M3NXp3OEVUdHpBVFNKdjhoN2tVRzlCbDFRUWdkQmtHcUtiNFpHLXI1Qmo2cHdKckhWbWdQU01vd1A4UDlHMTNpUUxGZEtYNzE0QTNETUtEYzAzVEp2czJ5Vks4MVlVQ3RPNWFSZHdiMHEwWWNGcW45QkhJM2NtTy1rT2hYcXVNYWtQUTN6V19GQlNuSWVCaEpNT2JDUU9tWUV1WnhyaWZNY0NRVFk3ajVqc1A5NjJlN1pQbjUzU1RjQ0F3RUFBUS4uUlNBLnNpZw",
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
