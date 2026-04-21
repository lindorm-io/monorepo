import { DomainError } from "./DomainError";
import { AggregateAlreadyCreatedError } from "./AggregateAlreadyCreatedError";
import { AggregateNotCreatedError } from "./AggregateNotCreatedError";
import { AggregateDestroyedError } from "./AggregateDestroyedError";
import { AggregateNotDestroyedError } from "./AggregateNotDestroyedError";
import { ConcurrencyError } from "./ConcurrencyError";
import { CommandSchemaValidationError } from "./CommandSchemaValidationError";
import { ChecksumError } from "./ChecksumError";
import { CausationMissingEventsError } from "./CausationMissingEventsError";
import { HandlerNotRegisteredError } from "./HandlerNotRegisteredError";
import { SagaAlreadyCreatedError } from "./SagaAlreadyCreatedError";
import { SagaNotCreatedError } from "./SagaNotCreatedError";
import { SagaDestroyedError } from "./SagaDestroyedError";
import { ViewAlreadyCreatedError } from "./ViewAlreadyCreatedError";
import { ViewNotCreatedError } from "./ViewNotCreatedError";
import { ViewDestroyedError } from "./ViewDestroyedError";
import { ViewNotUpdatedError } from "./ViewNotUpdatedError";
import { describe, expect, it } from "vitest";

describe("DomainError", () => {
  it("should default permanent to false", () => {
    const error = new DomainError("test error");

    expect(error.permanent).toBe(false);
    expect(error.message).toBe("test error");
  });

  it("should accept permanent option", () => {
    const error = new DomainError("permanent error", { permanent: true });

    expect(error.permanent).toBe(true);
  });

  it("should pass through LindormError options", () => {
    const error = new DomainError("detailed error", {
      permanent: true,
      code: "TEST_CODE",
    });

    expect(error.permanent).toBe(true);
    expect(error.code).toBe("TEST_CODE");
  });
});

describe("AggregateAlreadyCreatedError", () => {
  it("should create a permanent domain error", () => {
    const error = new AggregateAlreadyCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("AggregateNotCreatedError", () => {
  it("should create a permanent domain error", () => {
    const error = new AggregateNotCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("AggregateDestroyedError", () => {
  it("should create a permanent domain error", () => {
    const error = new AggregateDestroyedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("AggregateNotDestroyedError", () => {
  it("should create a permanent domain error", () => {
    const error = new AggregateNotDestroyedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("ConcurrencyError", () => {
  it("should create a LindormError (not a DomainError)", () => {
    const error = new ConcurrencyError("concurrency conflict");

    expect(error).not.toBeInstanceOf(DomainError);
    expect(error).toMatchSnapshot();
  });
});

describe("CommandSchemaValidationError", () => {
  it("should create a permanent domain error wrapping the original error", () => {
    const original = new Error("invalid field");
    const error = new CommandSchemaValidationError(original);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("ChecksumError", () => {
  it("should create a permanent domain error with message", () => {
    const error = new ChecksumError("checksum mismatch");

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });

  it("should accept an optional cause error", () => {
    const cause = new Error("underlying issue");
    const error = new ChecksumError("checksum mismatch", cause);

    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("CausationMissingEventsError", () => {
  it("should create a LindormError (not a DomainError)", () => {
    const error = new CausationMissingEventsError();

    expect(error).not.toBeInstanceOf(DomainError);
    expect(error).toMatchSnapshot();
  });
});

describe("HandlerNotRegisteredError", () => {
  it("should create a LindormError (not a DomainError)", () => {
    const error = new HandlerNotRegisteredError();

    expect(error).not.toBeInstanceOf(DomainError);
    expect(error).toMatchSnapshot();
  });
});

describe("SagaAlreadyCreatedError", () => {
  it("should default to non-permanent", () => {
    const error = new SagaAlreadyCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(false);
    expect(error).toMatchSnapshot();
  });

  it("should accept permanent flag", () => {
    const error = new SagaAlreadyCreatedError(true);

    expect(error.permanent).toBe(true);
  });
});

describe("SagaNotCreatedError", () => {
  it("should default to non-permanent", () => {
    const error = new SagaNotCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(false);
    expect(error).toMatchSnapshot();
  });

  it("should accept permanent flag", () => {
    const error = new SagaNotCreatedError(true);

    expect(error.permanent).toBe(true);
  });
});

describe("SagaDestroyedError", () => {
  it("should create a permanent domain error", () => {
    const error = new SagaDestroyedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("ViewAlreadyCreatedError", () => {
  it("should default to non-permanent", () => {
    const error = new ViewAlreadyCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(false);
    expect(error).toMatchSnapshot();
  });

  it("should accept permanent flag", () => {
    const error = new ViewAlreadyCreatedError(true);

    expect(error.permanent).toBe(true);
  });
});

describe("ViewNotCreatedError", () => {
  it("should default to non-permanent", () => {
    const error = new ViewNotCreatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(false);
    expect(error).toMatchSnapshot();
  });

  it("should accept permanent flag", () => {
    const error = new ViewNotCreatedError(true);

    expect(error.permanent).toBe(true);
  });
});

describe("ViewDestroyedError", () => {
  it("should create a permanent domain error", () => {
    const error = new ViewDestroyedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });
});

describe("ViewNotUpdatedError", () => {
  it("should create a permanent domain error with default message", () => {
    const error = new ViewNotUpdatedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.permanent).toBe(true);
    expect(error).toMatchSnapshot();
  });

  it("should accept a custom message", () => {
    const error = new ViewNotUpdatedError("custom failure");

    expect(error.message).toBe("custom failure");
    expect(error.permanent).toBe(true);
  });
});
