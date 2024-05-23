import { EcGenerate } from "./ec";
import { GenerateKryptosOptions } from "./kryptos";
import { OctGenerate } from "./oct";
import { OkpGenerate } from "./okp";
import { RsaGenerate } from "./rsa";
import { KryptosAlgorithm } from "./types";

export type GenerateEcKryptos = GenerateKryptosOptions & EcGenerate;

export type GenerateOctKryptos = GenerateKryptosOptions & OctGenerate;

export type GenerateOkpKryptos = GenerateKryptosOptions & OkpGenerate;

export type GenerateRsaKryptos = GenerateKryptosOptions & RsaGenerate;

export type GenerateKryptos =
  | GenerateEcKryptos
  | GenerateOctKryptos
  | GenerateOkpKryptos
  | GenerateRsaKryptos;

export type AutoGenerateKryptos = GenerateKryptosOptions & {
  algorithm: KryptosAlgorithm;
};
