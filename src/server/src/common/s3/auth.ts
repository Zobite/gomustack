/**
 * AWS Signature V4 authentication for S3-compatible API.
 *
 * Supports:
 * - Authorization header (AWS4-HMAC-SHA256)
 * - Query string auth (X-Amz-Algorithm + X-Amz-Credential + X-Amz-Signature)
 *
 * Access keys are fetched from the DB (created via UI/API).
 */

import { getSecretKeyForAccess } from "../../modules/storage/storage.service.js";

export interface S3AuthResult {
  authenticated: boolean;
  accessKey?: string;
  error?: string;
}

/**
 * Parse the Authorization header and verify credentials.
 */
export async function verifyS3Auth(
  method: string,
  path: string,
  queryString: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody?: Buffer,
): Promise<S3AuthResult> {
  const authHeader = getHeader(headers, "authorization");

  if (authHeader && authHeader.startsWith("AWS4-HMAC-SHA256")) {
    return verifySignatureV4(method, path, queryString, headers, rawBody ?? Buffer.alloc(0), authHeader);
  }

  // Query string auth (presigned URLs)
  const params = new URLSearchParams(queryString);
  const algorithm = params.get("X-Amz-Algorithm");
  if (algorithm === "AWS4-HMAC-SHA256") {
    const credential = params.get("X-Amz-Credential");
    if (credential) {
      const accessKey = credential.split("/")[0];
      const secret = await getSecretKeyForAccess(accessKey);
      if (secret) return { authenticated: true, accessKey };
      return { authenticated: false, error: "InvalidAccessKeyId" };
    }
  }

  return { authenticated: false, error: "MissingAuth" };
}

async function verifySignatureV4(
  method: string,
  path: string,
  queryString: string,
  headers: Record<string, string | string[] | undefined>,
  body: Buffer,
  authHeader: string,
): Promise<S3AuthResult> {
  // Parse: AWS4-HMAC-SHA256 Credential=<accessKey>/<date>/<region>/s3/aws4_request,
  //        SignedHeaders=<...>, Signature=<hex>
  const credMatch = authHeader.match(/Credential=([^/]+)\/([^,]+)/);
  const signedHeadersMatch = authHeader.match(/SignedHeaders=([^,]+)/);
  const signatureMatch = authHeader.match(/Signature=([a-f0-9]+)/);

  if (!credMatch || !signedHeadersMatch || !signatureMatch) {
    return { authenticated: false, error: "MalformedAuth" };
  }

  const accessKey = credMatch[1];
  const credentialScope = credMatch[2];
  const signedHeadersList = signedHeadersMatch[1].split(";");
  const clientSignature = signatureMatch[1];

  // Look up the decrypted secret key from DB
  const secretKey = await getSecretKeyForAccess(accessKey);
  if (!secretKey) {
    return { authenticated: false, error: "InvalidAccessKeyId" };
  }

  // ── Build Canonical Request ─────────────────────────────────────────────────
  const canonicalUri = path || "/";

  // Sort query params
  const qParams = new URLSearchParams(queryString);
  const sortedQs = [...qParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Canonical headers (must match signedHeaders order)
  const canonicalHeaders = signedHeadersList
    .map((h) => `${h}:${(getHeader(headers, h) ?? "").toString().trim()}`)
    .join("\n") + "\n";

  // Payload hash
  const xAmzContentSha256 = getHeader(headers, "x-amz-content-sha256");
  let payloadHash: string;
  if (xAmzContentSha256 === "UNSIGNED-PAYLOAD" || xAmzContentSha256 === "STREAMING-AWS4-HMAC-SHA256-PAYLOAD") {
    payloadHash = xAmzContentSha256;
  } else {
    payloadHash = await sha256Hex(body);
  }

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    sortedQs,
    canonicalHeaders,
    signedHeadersList.join(";"),
    payloadHash,
  ].join("\n");

  // ── String to Sign ──────────────────────────────────────────────────────────
  const dateHeader = getHeader(headers, "x-amz-date") ?? "";
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateHeader,
    credentialScope,
    await sha256Hex(Buffer.from(canonicalRequest, "utf-8")),
  ].join("\n");

  // ── Signing Key ─────────────────────────────────────────────────────────────
  const scopeParts = credentialScope.split("/"); // date/region/s3/aws4_request
  const dateKey = await hmacSha256(Buffer.from(`AWS4${secretKey}`, "utf-8"), scopeParts[0]);
  const regionKey = await hmacSha256(dateKey, scopeParts[1]);
  const serviceKey = await hmacSha256(regionKey, scopeParts[2]);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");

  // ── Compute Signature ───────────────────────────────────────────────────────
  const computedSig = await hmacSha256Hex(signingKey, stringToSign);

  if (computedSig === clientSignature) {
    return { authenticated: true, accessKey };
  }

  // Fallback: try with UNSIGNED-PAYLOAD (some clients use it differently)
  if (payloadHash !== "UNSIGNED-PAYLOAD") {
    const canonicalRequest2 = [
      method.toUpperCase(),
      canonicalUri,
      sortedQs,
      canonicalHeaders,
      signedHeadersList.join(";"),
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign2 = [
      "AWS4-HMAC-SHA256",
      dateHeader,
      credentialScope,
      await sha256Hex(Buffer.from(canonicalRequest2, "utf-8")),
    ].join("\n");

    const computedSig2 = await hmacSha256Hex(signingKey, stringToSign2);
    if (computedSig2 === clientSignature) {
      return { authenticated: true, accessKey };
    }
  }

  return { authenticated: false, error: "SignatureDoesNotMatch" };
}

// ── Crypto helpers (Bun native) ─────────────────────────────────────────────────

async function sha256Hex(data: Buffer | Uint8Array): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data);
  return hasher.digest("hex");
}

async function hmacSha256(key: Buffer | Uint8Array, data: string): Promise<Buffer> {
  const hmac = new Bun.CryptoHasher("sha256", key);
  hmac.update(data);
  return Buffer.from(hmac.digest());
}

async function hmacSha256Hex(key: Buffer | Uint8Array, data: string): Promise<string> {
  const hmac = new Bun.CryptoHasher("sha256", key);
  hmac.update(data);
  return hmac.digest("hex");
}

// ── Header helper ───────────────────────────────────────────────────────────────

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const val = headers[key.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
}
