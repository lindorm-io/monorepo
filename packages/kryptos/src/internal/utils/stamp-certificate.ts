import type { Environment } from "@lindorm/types";
import { KryptosError } from "../../errors/index.js";
import type { IKryptos } from "../../interfaces/index.js";
import type {
  KryptosAlgorithm,
  KryptosCertificateOption,
  KryptosCurve,
  KryptosType,
  KryptosUse,
  ParsedX509Certificate,
  X509SubjectAltNameInput,
} from "../../types/index.js";
import { isEnvironment } from "./is-environment.js";
import { computeSpkiKeyIdentifier } from "./x509/compute-spki-key-identifier.js";
import type { X509BasicConstraints, X509KeyUsageFlag } from "./x509/encode-extensions.js";
import type { X509NameInput } from "./x509/encode-name.js";
import { generateX509Certificate } from "./x509/generate-x509.js";
import { resolveSignAlgorithmForCert } from "./resolve-sign-algorithm.js";

type StampInput = {
  certificate: KryptosCertificateOption;
  subjectKryptos: {
    id: string;
    issuer: string | null;
    notBefore: Date;
    expiresAt: Date;
    use: KryptosUse;
    type: KryptosType;
    algorithm: KryptosAlgorithm;
    curve: KryptosCurve | null;
    publicKey: Buffer;
    privateKey?: Buffer;
  };
  serialNumber?: Buffer;
};

// The environment is stamped as the subject OU DN attribute (2.5.4.11).
const resolveSubject = (
  option: KryptosCertificateOption,
  issuer: string | null,
  id: string,
  environment: Environment | undefined,
): { commonName: string; organization?: string; organizationalUnit?: string } => ({
  commonName: option.subject ?? issuer ?? id,
  ...(option.organization !== undefined ? { organization: option.organization } : {}),
  ...(environment !== undefined ? { organizationalUnit: environment } : {}),
});

// HOUSE POLICY: dev/prod (etc.) hierarchies never mix. When a child is signed by
// a CA whose leaf carries an Environment OU, the child inherits it if it declared
// none; if the child declares a DIFFERENT environment, refuse to sign. A CA leaf
// with no OU, or a foreign (non-Environment) OU, imposes no constraint.
const resolveChildEnvironment = (
  child: Environment | undefined,
  caLeaf: ParsedX509Certificate,
): Environment | undefined => {
  const parent = caLeaf.subject.organizationalUnit;

  if (!isEnvironment(parent)) {
    return child;
  }

  if (child === undefined) {
    return parent;
  }

  if (child !== parent) {
    throw new KryptosError("cross-environment certificate signing", {
      code: "cross_environment_certificate_signing",
      title: "Cross-Environment Certificate Signing",
      details: `A '${child}' certificate cannot be signed by a '${parent}' CA; environment hierarchies (e.g. development and production) never mix.`,
      data: { childEnvironment: child, caEnvironment: parent },
    });
  }

  return child;
};

const normalizeSan = (
  entry: string | X509SubjectAltNameInput,
): X509SubjectAltNameInput =>
  typeof entry === "string" ? { type: "uri", value: entry } : entry;

// RFC 5280 §4.2.1.6: SAN is OPTIONAL when the subject DN is non-empty (ours
// always carries a CN) and required (critical) only when the DN is empty.
// Explicit `subjectAlternativeNames` always win in every mode; otherwise:
//   - CA certs (root-ca, intermediate-ca): no SAN — a CA is identified by DN.
//   - end-entity certs (self-signed, ca-signed): a URI SAN of the key's issuer
//     when set (URI GeneralName is scheme-unrestricted, §4.2.1.6), else none.
const resolveSans = (
  option: KryptosCertificateOption,
  issuer: string | null,
): ReadonlyArray<X509SubjectAltNameInput> => {
  if (option.subjectAlternativeNames && option.subjectAlternativeNames.length > 0) {
    return option.subjectAlternativeNames.map(normalizeSan);
  }

  switch (option.mode) {
    case "root-ca":
    case "intermediate-ca":
      return [];

    case "self-signed":
    case "ca-signed":
      return issuer ? [{ type: "uri", value: issuer }] : [];

    default:
      return [];
  }
};

const keyUsageForUse = (use: KryptosUse): ReadonlyArray<X509KeyUsageFlag> =>
  use === "sig" ? ["digitalSignature"] : ["keyEncipherment", "dataEncipherment"];

// CA cert key usage per RFC 5280 §4.2.1.3 (keyCertSign asserts cA=true).
const CA_KEY_USAGE: ReadonlyArray<X509KeyUsageFlag> = ["keyCertSign", "cRLSign"];

type ValidatedCa = {
  ca: IKryptos;
  caLeaf: ParsedX509Certificate;
  caSki: Buffer;
  caPrivateKey: Buffer;
};

// Validate that a Kryptos can sign child certificates: private key present, a
// certificate with basicConstraints cA=true (§4.2.1.9), a subjectKeyIdentifier
// to become the child's AKI (§4.2.1.1/§4.2.1.2), and keyCertSign in keyUsage
// (§4.2.1.3).
const assertSigningCa = (ca: IKryptos): ValidatedCa => {
  if (!ca.hasPrivateKey) {
    throw new KryptosError("CA-signing requires CA kryptos with a private key", {
      code: "missing_ca_private_key",
      title: "Missing CA Private Key",
      details:
        "Signing a certificate requires the CA Kryptos to contain a private key for signing.",
    });
  }

  if (!ca.hasCertificate || !ca.certificateChain || !ca.certificate) {
    throw new KryptosError("CA-signing requires CA kryptos with a certificate", {
      code: "missing_ca_certificate",
      title: "Missing CA Certificate",
      details:
        "Signing a certificate requires the CA Kryptos to have a certificate and a complete certificate chain.",
    });
  }

  const caLeaf = ca.certificate;

  if (!caLeaf.extensions.basicConstraintsCa) {
    throw new KryptosError(
      "signing CA leaf cert must have basicConstraints cA=true (RFC 5280 §4.2.1.9)",
      {
        code: "invalid_ca_certificate",
        title: "Invalid CA Certificate",
        details:
          "The CA leaf certificate must have the basicConstraints extension with cA=true to sign child certificates (RFC 5280 §4.2.1.9).",
      },
    );
  }

  const caSki = caLeaf.extensions.subjectKeyIdentifier;
  if (!caSki) {
    throw new KryptosError(
      "signing CA leaf cert must have a subjectKeyIdentifier extension (RFC 5280 §4.2.1.2)",
      {
        code: "invalid_ca_certificate",
        title: "Invalid CA Certificate",
        details:
          "The CA leaf certificate must include a subjectKeyIdentifier extension to act as the child's authority key identifier (RFC 5280 §4.2.1.2).",
      },
    );
  }

  if (!caLeaf.extensions.keyUsage.includes("keyCertSign")) {
    throw new KryptosError(
      "signing CA leaf cert must have keyCertSign in keyUsage (RFC 5280 §4.2.1.3)",
      {
        code: "invalid_ca_certificate",
        title: "Invalid CA Certificate",
        details:
          "The CA leaf certificate must include keyCertSign in its keyUsage extension to sign child certificates (RFC 5280 §4.2.1.3).",
      },
    );
  }

  const caDer = ca.export("der");
  if (!caDer.privateKey) {
    throw new KryptosError("CA-signing requires CA kryptos with a private key", {
      code: "missing_ca_private_key",
      title: "Missing CA Private Key",
      details:
        "Signing a certificate requires the exported CA Kryptos to expose a private key for signing.",
    });
  }

  return { ca, caLeaf, caSki, caPrivateKey: caDer.privateKey };
};

const assertValidityWithinCa = (
  subjectKryptos: StampInput["subjectKryptos"],
  caLeaf: ParsedX509Certificate,
): void => {
  if (
    subjectKryptos.notBefore.getTime() < caLeaf.notBefore.getTime() ||
    subjectKryptos.expiresAt.getTime() > caLeaf.notAfter.getTime()
  ) {
    throw new KryptosError(
      "ca-signed child validity window must fit within the CA's validity window",
      {
        code: "invalid_certificate_validity_window",
        title: "Invalid Certificate Validity Window",
        details:
          "The child certificate's notBefore and expiresAt must fall within the CA certificate's validity window.",
      },
    );
  }
};

// RFC 5280 §4.2.1.9 mint-time guards for issuing an intermediate CA.
const assertIntermediatePathLen = (
  parentPathLen: number | undefined,
  childPathLen: number | undefined,
): void => {
  // "Where pathLenConstraint is zero, the subject may issue certificates, but
  // only to end entities, not to CAs" (§4.2.1.9) — refuse to mint an
  // intermediate under a pathLen=0 issuer.
  if (parentPathLen === 0) {
    throw new KryptosError(
      "issuing CA has pathLenConstraint=0 and may only issue end-entity certificates (RFC 5280 §4.2.1.9)",
      {
        code: "invalid_intermediate_ca_path_length",
        title: "Invalid Intermediate CA Path Length",
        details:
          "The issuing CA's basicConstraints pathLenConstraint is 0, so per RFC 5280 §4.2.1.9 it may only sign end-entity certificates, not further CAs.",
        data: { parentPathLen },
      },
    );
  }

  // HOUSE POLICY: RFC 5280 §6.1.4 path validation would merely clamp the child's
  // effective path length via min(); we go further and refuse to MINT a cert
  // whose declared pathLenConstraint would be misleading. Under a parent with
  // pathLen N, a child CA must declare pathLen < N.
  if (
    parentPathLen !== undefined &&
    childPathLen !== undefined &&
    childPathLen >= parentPathLen
  ) {
    throw new KryptosError(
      "intermediate CA pathLengthConstraint must be strictly less than its issuer's",
      {
        code: "invalid_intermediate_ca_path_length",
        title: "Invalid Intermediate CA Path Length",
        details: `An intermediate CA's pathLengthConstraint (${childPathLen}) must be strictly less than its issuing CA's (${parentPathLen}).`,
        data: { parentPathLen, childPathLen },
      },
    );
  }
};

const buildCaSignedDer = (
  input: StampInput,
  validated: ValidatedCa,
  subjectName: X509NameInput,
  sans: ReadonlyArray<X509SubjectAltNameInput>,
  basicConstraints: X509BasicConstraints,
  keyUsage: ReadonlyArray<X509KeyUsageFlag>,
): Buffer => {
  const { subjectKryptos } = input;
  const { ca, caLeaf, caSki, caPrivateKey } = validated;

  const caSignAlgorithm = resolveSignAlgorithmForCert({
    type: ca.type,
    algorithm: ca.algorithm,
    curve: ca.curve,
  });

  return generateX509Certificate({
    subjectKryptos: {
      publicKey: subjectKryptos.publicKey,
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
    },
    issuerKryptos: {
      privateKey: caPrivateKey,
      type: ca.type,
      algorithm: caSignAlgorithm,
    },
    subject: subjectName,
    issuer: { raw: caLeaf.subject.raw },
    notBefore: subjectKryptos.notBefore,
    notAfter: subjectKryptos.expiresAt,
    basicConstraints,
    keyUsage,
    subjectAlternativeNames: sans,
    authorityKeyIdentifier: caSki,
    ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
  });
};

const buildSelfIssuedDer = (
  input: StampInput,
  subjectName: X509NameInput,
  sans: ReadonlyArray<X509SubjectAltNameInput>,
  basicConstraints: X509BasicConstraints,
  keyUsage: ReadonlyArray<X509KeyUsageFlag>,
  // RFC 5280 §4.2.1.1: a self-signed CA MAY omit AKI. A self-signed end-entity
  // leaf sets AKI = own SKI; a root CA omits it.
  includeAuthorityKeyIdentifier: boolean,
): Buffer => {
  const { subjectKryptos } = input;

  const signAlgorithm = resolveSignAlgorithmForCert({
    type: subjectKryptos.type,
    algorithm: subjectKryptos.algorithm,
    curve: subjectKryptos.curve,
  });

  const ownSki = includeAuthorityKeyIdentifier
    ? computeSpkiKeyIdentifier(subjectKryptos.publicKey, subjectKryptos.type)
    : undefined;

  return generateX509Certificate({
    subjectKryptos: {
      publicKey: subjectKryptos.publicKey,
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
    },
    issuerKryptos: {
      privateKey: subjectKryptos.privateKey!,
      type: subjectKryptos.type,
      algorithm: signAlgorithm,
    },
    subject: subjectName,
    issuer: subjectName,
    notBefore: subjectKryptos.notBefore,
    notAfter: subjectKryptos.expiresAt,
    basicConstraints,
    keyUsage,
    subjectAlternativeNames: sans,
    ...(ownSki ? { authorityKeyIdentifier: ownSki } : {}),
    ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
  });
};

export const stampCertificate = (input: StampInput): Array<string> => {
  const { certificate, subjectKryptos } = input;

  if (subjectKryptos.type === "oct") {
    throw new KryptosError("symmetric keys cannot have certificates", {
      code: "symmetric_key_certificate_unsupported",
      title: "Symmetric Key Certificate Unsupported",
      details: "Symmetric (oct) keys cannot be used to sign or carry X.509 certificates.",
      data: { type: subjectKryptos.type },
    });
  }

  if (!subjectKryptos.privateKey) {
    throw new KryptosError(
      "certificate generation requires the generated kryptos to have a private key",
      {
        code: "missing_private_key",
        title: "Missing Private Key",
        details:
          "Certificate generation requires the generated Kryptos to contain a private key.",
      },
    );
  }

  const sans = resolveSans(certificate, subjectKryptos.issuer);

  // The subject OU (environment) is resolved per mode: self-issued certs take it
  // verbatim; CA-signed certs may inherit it from the signing CA (see
  // resolveChildEnvironment), which needs the CA leaf, so those branches build
  // the subject after validation.
  const subjectFor = (environment: Environment | undefined): X509NameInput =>
    resolveSubject(certificate, subjectKryptos.issuer, subjectKryptos.id, environment);

  switch (certificate.mode) {
    case "self-signed": {
      const der = buildSelfIssuedDer(
        input,
        subjectFor(certificate.environment),
        sans,
        { ca: false },
        keyUsageForUse(subjectKryptos.use),
        true,
      );
      return [der.toString("base64")];
    }

    case "root-ca": {
      const der = buildSelfIssuedDer(
        input,
        subjectFor(certificate.environment),
        sans,
        {
          ca: true,
          ...(certificate.pathLengthConstraint !== undefined
            ? { pathLengthConstraint: certificate.pathLengthConstraint }
            : {}),
        },
        CA_KEY_USAGE,
        false,
      );
      return [der.toString("base64")];
    }

    case "ca-signed": {
      const validated = assertSigningCa(certificate.ca);
      assertValidityWithinCa(subjectKryptos, validated.caLeaf);
      const environment = resolveChildEnvironment(
        certificate.environment,
        validated.caLeaf,
      );

      const der = buildCaSignedDer(
        input,
        validated,
        subjectFor(environment),
        sans,
        { ca: false },
        keyUsageForUse(subjectKryptos.use),
      );
      return [der.toString("base64"), ...certificate.ca.certificateChain];
    }

    case "intermediate-ca": {
      const validated = assertSigningCa(certificate.ca);
      assertValidityWithinCa(subjectKryptos, validated.caLeaf);
      assertIntermediatePathLen(
        validated.caLeaf.extensions.basicConstraintsPathLen,
        certificate.pathLengthConstraint,
      );
      const environment = resolveChildEnvironment(
        certificate.environment,
        validated.caLeaf,
      );

      const der = buildCaSignedDer(
        input,
        validated,
        subjectFor(environment),
        sans,
        {
          ca: true,
          ...(certificate.pathLengthConstraint !== undefined
            ? { pathLengthConstraint: certificate.pathLengthConstraint }
            : {}),
        },
        CA_KEY_USAGE,
      );
      return [der.toString("base64"), ...certificate.ca.certificateChain];
    }

    default:
      throw new KryptosError(
        `Unsupported certificate mode: ${(certificate as { mode: string }).mode}`,
        {
          code: "unsupported_certificate_mode",
          title: "Unsupported Certificate Mode",
          details: `The certificate mode "${(certificate as { mode: string }).mode}" is not supported.`,
          data: { mode: (certificate as { mode: string }).mode },
        },
      );
  }
};
