import { describe, expect, test } from "vitest";
import { errorRegistry } from "../registry/ErrorRegistry.js";
import { ClientError } from "./ClientError.js";
import { LindormError } from "./LindormError.js";
import { ServerError } from "./ServerError.js";
import * as Client from "./client/index.js";
import * as Server from "./server/index.js";

type HttpErrorClass = {
  new (message: string): LindormError;
  readonly name: string;
  readonly status: number;
};

const clientCases = Object.entries(Client) as Array<[string, HttpErrorClass]>;
const serverCases = Object.entries(Server) as Array<[string, HttpErrorClass]>;

describe("HTTP status subclasses", () => {
  describe("client (4xx)", () => {
    for (const [name, Cls] of clientCases) {
      describe(name, () => {
        test("constructs with declared status and matching title", () => {
          const err = new Cls("test message");

          expect(err).toBeInstanceOf(ClientError);
          expect(err).toBeInstanceOf(LindormError);
          expect(err).toBeInstanceOf(Error);

          expect({
            name: err.name,
            status: err.status,
            title: err.title,
            message: err.message,
          }).toMatchSnapshot();
        });

        test("self-registers in errorRegistry by name and by status", () => {
          expect(errorRegistry.resolve({ name })).toBe(Cls);
          expect(errorRegistry.resolve({ status: Cls.status })).toBe(Cls);
        });
      });
    }
  });

  describe("server (5xx)", () => {
    for (const [name, Cls] of serverCases) {
      describe(name, () => {
        test("constructs with declared status and matching title", () => {
          const err = new Cls("test message");

          expect(err).toBeInstanceOf(ServerError);
          expect(err).toBeInstanceOf(LindormError);
          expect(err).toBeInstanceOf(Error);

          expect({
            name: err.name,
            status: err.status,
            title: err.title,
            message: err.message,
          }).toMatchSnapshot();
        });

        test("self-registers in errorRegistry by name and by status", () => {
          expect(errorRegistry.resolve({ name })).toBe(Cls);
          expect(errorRegistry.resolve({ status: Cls.status })).toBe(Cls);
        });
      });
    }
  });

  describe("counts", () => {
    test("exposes one class per Status enum entry", () => {
      expect(clientCases).toHaveLength(30);
      expect(serverCases).toHaveLength(12);
    });
  });
});
