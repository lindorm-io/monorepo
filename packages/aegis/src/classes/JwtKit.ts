import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { JwtError } from "../errors/index.js";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "../internal/utils/compute-typ-header.js";
import { extractTokenDelegation } from "../internal/utils/extract-token-delegation.js";
import { validateActor } from "../internal/utils/validate-actor.js";
import { validateCrit } from "../internal/utils/validate-crit.js";
import { verifyDpopProof } from "../internal/utils/verify-dpop-proof.js";
import type { IJwtKit } from "../interfaces/index.js";
import type {
  CertBindingMode,
  DecodedJwt,
  JwtKitOptions,
  ParsedJwt,
  ParsedJwtHeader,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  TokenHeaderOptions,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../types/index.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import {
  decodeJwtPayload,
  encodeJwtPayload,
  parseTokenPayload,
} from "../internal/utils/jwt-payload.js";
import { createJwtVerify } from "../internal/utils/jwt-verify.js";
import { parseTokenHeader } from "../internal/utils/token-header.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { validate } from "../internal/utils/validate.js";

const DEFAULT_DPOP_MAX_SKEW = 60;

export class JwtKit implements IJwtKit {
  private readonly certBindingMode: CertBindingMode;
  private readonly clockTolerance: number;
  private readonly dpopMaxSkew: number;
  private readonly issuer: string | null;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: JwtKitOptions) {
    this.logger = options.logger.child(["JwtKit"]);
    this.kryptos = options.kryptos;
    this.issuer = options.issuer ?? null;

    this.certBindingMode = options.certBindingMode ?? "strict";
    this.clockTolerance = options.clockTolerance ?? 0;
    this.dpopMaxSkew = options.dpopMaxSkew ?? DEFAULT_DPOP_MAX_SKEW;
  }

  public sign<C extends Dict = Dict>(
    content: SignJwtContent<C>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    this.logger.debug("Signing token", { content, options });

    if (!this.issuer) {
      throw new JwtError("Issuer is required to sign JWT", {
        code: "jwt_issuer_required",
        title: "JWT Issuer Required",
        details:
          "The kit was constructed without an issuer, so it cannot populate the mandatory iss claim when signing.",
      });
    }

    const objectId = options.objectId;

    const headerOptions: TokenHeaderOptions = {
      ...(options.header ?? {}),
      algorithm: this.kryptos.algorithm,
      contentType: "application/json",
      headerType: computeTypHeader(content.tokenType, "jwt"),
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
    };

    const cert = resolveCertBinding(this.kryptos, options.bindCertificate);

    const header = encodeJoseHeader(headerOptions, cert);

    const { expiresAt, expiresIn, expiresOn, payload, tokenId } = encodeJwtPayload<C>(
      { algorithm: this.kryptos.algorithm, issuer: this.issuer },
      content,
      options,
    );

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token });

    return { expiresAt, expiresIn, expiresOn, objectId, token, tokenId };
  }

  public verify<C extends Dict = Dict>(
    token: string,
    verify: VerifyJwtOptions = {},
  ): ParsedJwt<C> {
    this.logger.debug("Verifying token", { token, verify });

    const parsed = JwtKit.parse<C>(token);

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (parsed.header.critical?.length) {
      for (const param of parsed.header.critical) {
        throw new JwtError(`Unsupported critical header parameter: ${param}`, {
          code: "jwt_unsupported_crit_param",
          data: { param },
          title: "JWT Unsupported Crit Param",
          details:
            "The crit header marks an extension parameter as critical that Aegis does not understand, so the JWT must be rejected.",
        });
      }
    }

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwtError("Invalid token", {
        code: "jwt_algorithm_mismatch",
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
        title: "JWT Algorithm Mismatch",
        details:
          "The header alg does not match the signing algorithm of the configured kryptos key.",
      });
    }

    if (verify.tokenType !== undefined) {
      const expectedTyp = computeTypHeader(verify.tokenType, "jwt");
      if (parsed.decoded.header.typ !== expectedTyp) {
        throw new JwtError("Invalid token", {
          code: "jwt_typ_mismatch",
          data: { typ: parsed.decoded.header.typ },
          debug: { expected: expectedTyp },
          title: "JWT Typ Mismatch",
          details:
            "The header typ does not match the typ expected for the requested tokenType during verification.",
        });
      }
    }

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwtError("Invalid token", {
        code: "jwt_signature_invalid",
        debug: { token },
        title: "JWT Signature Invalid",
        details:
          "The signature did not verify against the configured kryptos key, indicating the JWT was tampered with or signed by another key.",
      });
    }

    // Content tamper check: this runs AFTER signature verification has
    // already succeeded with the amphora-sourced kryptos. It is NOT a key
    // selection step. Header cert fields remain forbidden as key sources
    // — see the SECURITY INVARIANT in Aegis.kryptosSig.
    verifyCertBinding({
      header: {
        x5tS256: parsed.header.x5tS256,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: this.certBindingMode,
    });

    const predicate = createJwtVerify(
      this.kryptos.algorithm,
      verify,
      this.clockTolerance,
    );

    const {
      decoded: { payload },
    } = parsed;

    const withDates = {
      ...payload,
      exp: payload.exp ? new Date(payload.exp * 1000) : undefined,
      iat: payload.iat ? new Date(payload.iat * 1000) : undefined,
      nbf: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
      auth_time: payload.auth_time ? new Date(payload.auth_time * 1000) : undefined,
    };

    try {
      validate(withDates, predicate);
    } catch (err) {
      throw new JwtError("Invalid token", {
        code: "jwt_claims_invalid",
        data: { invalid: (err as any).data?.invalid },
        debug: { invalid: (err as any).debug?.invalid },
        title: "JWT Claims Invalid",
        details:
          "One or more claims (such as exp, nbf, iat, or a verifier-supplied claim) failed the validation predicate.",
      });
    }

    const actorError = validateActor(parsed.delegation, verify.actor);
    if (actorError) {
      throw new JwtError(actorError.message, {
        code: "jwt_actor_not_allowed",
        debug: actorError.debug,
        title: "JWT Actor Not Allowed",
        details:
          "The token's act delegation chain does not satisfy the expected actor supplied to verify.",
      });
    }

    const boundThumbprint = parsed.payload.confirmation?.thumbprint;

    if (verify.dpopProof !== undefined) {
      if (!boundThumbprint) {
        throw new JwtError("Invalid token: DPoP proof provided but token is not bound", {
          code: "jwt_dpop_token_not_bound",
          debug: { confirmation: parsed.payload.confirmation },
          title: "JWT DPoP Token Not Bound",
          details:
            "A DPoP proof was supplied but the token carries no cnf.jkt thumbprint, so it cannot be DPoP-bound.",
        });
      }
      parsed.dpop = verifyDpopProof({
        proof: verify.dpopProof,
        accessToken: token,
        expectedThumbprint: boundThumbprint,
        dpopMaxSkew: this.dpopMaxSkew,
      });
    } else if (boundThumbprint && !verify.trustBoundThumbprint) {
      throw new JwtError(
        "Invalid token: token is DPoP-bound but no DPoP proof was provided",
        {
          code: "jwt_dpop_proof_required",
          title: "JWT DPoP Proof Required",
          details:
            "The token carries a cnf.jkt thumbprint, so a matching DPoP proof must be supplied unless trustBoundThumbprint is set.",
        },
      );
    }

    this.logger.debug("Token verified");

    return parsed;
  }

  // public static

  public static isJwt(jwt: string): boolean {
    if (typeof jwt !== "string") return false;
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    try {
      const header = decodeJoseHeader(parts[0]);
      if (typeof header.alg !== "string") return false;
      const typ = header.typ;
      return typ === "JWT" || (typeof typ === "string" && typ.endsWith("+jwt"));
    } catch {
      return false;
    }
  }

  public static decode<C extends Dict = Dict>(jwt: string): DecodedJwt<C> {
    const [header, payload, signature] = jwt.split(".");

    return {
      header: decodeJoseHeader(header),
      payload: decodeJwtPayload<C>(payload),
      signature,
    };
  }

  public static parse<C extends Dict = Dict>(token: string): ParsedJwt<C> {
    const decoded = JwtKit.decode<C>(token);

    const typ = decoded.header.typ;
    if (typ !== "JWT" && !(typeof typ === "string" && typ.endsWith("+jwt"))) {
      throw new JwtError("Invalid token", {
        code: "jwt_invalid_typ",
        data: { typ },
        title: "JWT Invalid Typ",
        details: "Header typ must be JWT or a <type>+jwt media type to parse as a JWT.",
      });
    }

    const critError = validateCrit(decoded.header);
    if (critError) {
      throw new JwtError(`Invalid crit header: ${critError}`, {
        code: "jwt_invalid_crit",
        data: { crit: decoded.header.crit },
        title: "JWT Invalid Crit",
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    if (!decoded.payload.iss) {
      throw new JwtError("Invalid token", {
        code: "jwt_issuer_missing",
        data: { iss: decoded.payload.iss },
        title: "JWT Issuer Missing",
        details: "The payload has no iss claim, which is required to parse a JWT.",
      });
    }

    const header = parseTokenHeader<ParsedJwtHeader>(decoded.header);
    header.tokenType = decodeTokenTypeFromTyp(typ, "jwt");
    header.baseFormat = "JWT";

    const payload = parseTokenPayload<C>(decoded.payload);

    const delegation = extractTokenDelegation(decoded.payload as { act?: any });

    return { decoded, delegation, header, payload, token };
  }

  public static validate<C extends Dict = Dict>(
    payload: ParsedJwtPayload<C>,
    options: ValidateJwtOptions,
  ): void {
    const operators = createJwtValidate(options);

    validate(payload, operators);
  }
}
