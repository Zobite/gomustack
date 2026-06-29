import { message } from "antd";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE, client } from "src/lib/client";
import type { Bucket } from "src/lib/types";

// ══════════════════════════════════════════════════════════════════════════════
//  STORAGE — API & PROMPT PANEL (inline, shown as a tab view)
// ══════════════════════════════════════════════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

export default function StorageApiDocsPanel() {
  const [copied, setCopied] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  const apiHost = API_BASE ? API_BASE : window.location.origin;

  // Fetch buckets on mount
  useEffect(() => {
    client.storage
      .listBuckets()
      .then((r) => setBuckets(r.items))
      .catch(() => {});
  }, []);

  const bucketsSection =
    buckets.length > 0
      ? `### Available Buckets

| Bucket | Visibility | Objects | Size |
|--------|-----------|---------|------|
${buckets.map((b) => `| \`${b.name}\` | ${b.isPublic ? "Public" : "Private"} | ${b.objectCount} | ${formatBytes(b.totalSize)} |`).join("\n")}

---

`
      : "";

  const llmPrompt = `This document provides instructions to interact with GomuStack Object Storage using the S3-compatible API.

${bucketsSection}### Setup

- **S3 Endpoint**: \`${apiHost}/s3\`
- **Region**: \`us-east-1\` (any value works, required by SDK)
- **Force Path Style**: \`true\` (required)
- **Credentials**: Create access keys from the Storage dashboard → Access Keys tab.

\`\`\`javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: "${apiHost}/s3",
  forcePathStyle: true,
  region: "us-east-1",
  credentials: {
    accessKeyId: "YOUR_ACCESS_KEY",
    secretAccessKey: "YOUR_SECRET_KEY",
  },
});
\`\`\`

---

### Upload a File (PutObject)

\`\`\`javascript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

// Upload from buffer
await s3.send(new PutObjectCommand({
  Bucket: "my-bucket",
  Key: "photos/vacation.jpg",
  Body: readFileSync("./vacation.jpg"),
  ContentType: "image/jpeg",
}));

// Upload text/JSON
await s3.send(new PutObjectCommand({
  Bucket: "my-bucket",
  Key: "data/config.json",
  Body: JSON.stringify({ theme: "dark" }),
  ContentType: "application/json",
}));
\`\`\`

---

### Download a File (GetObject)

\`\`\`javascript
import { GetObjectCommand } from "@aws-sdk/client-s3";

const response = await s3.send(new GetObjectCommand({
  Bucket: "my-bucket",
  Key: "photos/vacation.jpg",
}));

// Read as buffer (Node.js)
const chunks = [];
for await (const chunk of response.Body) {
  chunks.push(chunk);
}
const buffer = Buffer.concat(chunks);

// Or read as string (for text/JSON)
const text = await response.Body.transformToString();
\`\`\`

---

### List Objects (ListObjectsV2)

\`\`\`javascript
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

// List all objects in a bucket
const result = await s3.send(new ListObjectsV2Command({
  Bucket: "my-bucket",
}));
console.log(result.Contents); // [{ Key, Size, LastModified, ETag }, ...]

// List with prefix (folder-like)
const photos = await s3.send(new ListObjectsV2Command({
  Bucket: "my-bucket",
  Prefix: "photos/",
  Delimiter: "/",
}));
console.log(photos.Contents);        // files in photos/
console.log(photos.CommonPrefixes);  // "sub-folders" in photos/

// Pagination
const page = await s3.send(new ListObjectsV2Command({
  Bucket: "my-bucket",
  MaxKeys: 100,
  ContinuationToken: previousResult.NextContinuationToken,
}));
\`\`\`

---

### Delete an Object

\`\`\`javascript
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

await s3.send(new DeleteObjectCommand({
  Bucket: "my-bucket",
  Key: "photos/vacation.jpg",
}));
\`\`\`

---

### Presigned URL (Temporary Access Link)

Generate a temporary URL that allows anyone to download a private file without credentials:

\`\`\`javascript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const url = await getSignedUrl(
  s3,
  new GetObjectCommand({
    Bucket: "my-bucket",
    Key: "secret/report.pdf",
  }),
  { expiresIn: 3600 } // 1 hour
);
console.log(url); // Share this URL — no auth needed, expires in 1h
\`\`\`

Or generate a presigned URL for **uploading** (allow someone to upload without credentials):

\`\`\`javascript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const uploadUrl = await getSignedUrl(
  s3,
  new PutObjectCommand({
    Bucket: "my-bucket",
    Key: "uploads/user-file.pdf",
    ContentType: "application/pdf",
  }),
  { expiresIn: 600 } // 10 minutes
);
// Client can PUT to this URL directly
\`\`\`

---

### Public File Access

Files marked as public (via the dashboard) can be accessed directly without any authentication:

\`\`\`
${apiHost}/public/{bucket}/{key}
\`\`\`

Example: \`${apiHost}/public/my-bucket/photos/vacation.jpg\`

---

### Supported S3 Operations

| Operation         | SDK Command              | Description                    |
|-------------------|--------------------------|--------------------------------|
| ListBuckets       | ListBucketsCommand       | List all buckets               |
| CreateBucket      | CreateBucketCommand      | Create a new bucket            |
| DeleteBucket      | DeleteBucketCommand      | Delete an empty bucket         |
| ListObjectsV2     | ListObjectsV2Command     | List objects (with pagination) |
| PutObject         | PutObjectCommand         | Upload a file                  |
| GetObject         | GetObjectCommand         | Download a file                |
| HeadObject        | HeadObjectCommand        | Get object metadata only       |
| DeleteObject      | DeleteObjectCommand      | Delete a single object         |
| DeleteObjects     | DeleteObjectsCommand     | Bulk delete multiple objects   |
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(llmPrompt);
      setCopied(true);
      message.success("LLM Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error("Failed to copy prompt");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <span className="font-semibold text-[15px] text-ink">API & Prompt</span>
          <br />
          <span className="text-[12px] text-muted">Copy-paste this prompt into your LLM to enable S3 storage interaction</span>
        </div>
      </div>

      {/* Prompt View */}
      <div className="flex flex-col border border-hairline rounded-lg overflow-hidden bg-canvas-soft">
        <div className="flex justify-between items-center bg-canvas-soft px-4 py-2.5 border-b border-hairline shrink-0">
          {/* Simulated IDE tab indicators */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
              <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
              <div className="w-2.5 h-2.5 rounded-full border border-hairline-strong" />
            </div>
            <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">llm-storage-instructions.md</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-hairline rounded bg-surface-card hover:bg-canvas transition-colors cursor-pointer text-ink"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy Prompt"}
          </button>
        </div>
        <pre className="m-0 p-4 bg-surface-card text-ink font-mono text-[12px] overflow-auto max-h-[calc(100vh-280px)] leading-relaxed whitespace-pre-wrap select-text selection:bg-surface-strong">
          {llmPrompt}
        </pre>
      </div>
    </div>
  );
}
