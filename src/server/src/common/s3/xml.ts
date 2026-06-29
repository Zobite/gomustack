/**
 * S3 XML response builders.
 * Produces XML strings conforming to S3 API format.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

// ── Error XML ───────────────────────────────────────────────────────────────────

export function errorXml(
  code: string,
  message: string,
  extra?: Record<string, string>,
): string {
  const extraTags = extra
    ? Object.entries(extra)
        .map(([k, v]) => `  <${k}>${escapeXml(v)}</${k}>`)
        .join("\n")
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>${escapeXml(code)}</Code>
  <Message>${escapeXml(message)}</Message>
${extraTags}
</Error>`;
}

// ── ListAllMyBucketsResult ──────────────────────────────────────────────────────

export interface S3BucketEntry {
  name: string;
  createdAt: number;
}

export function listAllMyBucketsXml(bucketList: S3BucketEntry[], ownerId = "zobite"): string {
  const bucketsXml = bucketList
    .map(
      (b) => `    <Bucket>
      <Name>${escapeXml(b.name)}</Name>
      <CreationDate>${toIsoDate(b.createdAt)}</CreationDate>
    </Bucket>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>${escapeXml(ownerId)}</ID>
    <DisplayName>${escapeXml(ownerId)}</DisplayName>
  </Owner>
  <Buckets>
${bucketsXml}
  </Buckets>
</ListAllMyBucketsResult>`;
}

// ── ListBucketResult (ListObjectsV2) ────────────────────────────────────────────

export interface S3ObjectEntry {
  key: string;
  lastModified: number;
  etag: string;
  size: number;
  storageClass?: string;
}

export function listObjectsV2Xml(opts: {
  bucketName: string;
  prefix: string;
  delimiter: string;
  maxKeys: number;
  items: S3ObjectEntry[];
  commonPrefixes: string[];
  isTruncated: boolean;
  continuationToken?: string;
  nextContinuationToken?: string;
  keyCount: number;
}): string {
  const contentsXml = opts.items
    .map(
      (obj) => `  <Contents>
    <Key>${escapeXml(obj.key)}</Key>
    <LastModified>${toIsoDate(obj.lastModified)}</LastModified>
    <ETag>&quot;${escapeXml(obj.etag)}&quot;</ETag>
    <Size>${obj.size}</Size>
    <StorageClass>${obj.storageClass ?? "STANDARD"}</StorageClass>
  </Contents>`,
    )
    .join("\n");

  const prefixesXml = opts.commonPrefixes
    .map((p) => `  <CommonPrefixes>\n    <Prefix>${escapeXml(p)}</Prefix>\n  </CommonPrefixes>`)
    .join("\n");

  const contTokenTag = opts.continuationToken
    ? `  <ContinuationToken>${escapeXml(opts.continuationToken)}</ContinuationToken>`
    : "";
  const nextContTokenTag =
    opts.isTruncated && opts.nextContinuationToken
      ? `  <NextContinuationToken>${escapeXml(opts.nextContinuationToken)}</NextContinuationToken>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${escapeXml(opts.bucketName)}</Name>
  <Prefix>${escapeXml(opts.prefix)}</Prefix>
  <Delimiter>${escapeXml(opts.delimiter)}</Delimiter>
  <MaxKeys>${opts.maxKeys}</MaxKeys>
  <IsTruncated>${opts.isTruncated}</IsTruncated>
  <KeyCount>${opts.keyCount}</KeyCount>
${contTokenTag}
${nextContTokenTag}
${contentsXml}
${prefixesXml}
</ListBucketResult>`;
}

// ── CopyObjectResult ──────────────────────────────────────────────────────────

export function copyObjectResultXml(etag: string, lastModified: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult>
  <ETag>&quot;${escapeXml(etag)}&quot;</ETag>
  <LastModified>${toIsoDate(lastModified)}</LastModified>
</CopyObjectResult>`;
}

// ── DeleteResult (bulk delete) ──────────────────────────────────────────────────

export interface DeletedEntry {
  key: string;
}

export interface DeleteErrorEntry {
  key: string;
  code: string;
  message: string;
}

export function deleteResultXml(
  deleted: DeletedEntry[],
  errors: DeleteErrorEntry[],
): string {
  const deletedXml = deleted
    .map((d) => `  <Deleted>\n    <Key>${escapeXml(d.key)}</Key>\n  </Deleted>`)
    .join("\n");

  const errorsXml = errors
    .map(
      (e) => `  <Error>
    <Key>${escapeXml(e.key)}</Key>
    <Code>${escapeXml(e.code)}</Code>
    <Message>${escapeXml(e.message)}</Message>
  </Error>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${deletedXml}
${errorsXml}
</DeleteResult>`;
}

// ── InitiateMultipartUploadResult ───────────────────────────────────────────────

export function locationConstraintXml(location: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LocationConstraint>${escapeXml(location)}</LocationConstraint>
</CreateBucketConfiguration>`;
}
