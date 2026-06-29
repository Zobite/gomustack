import type { HttpClient } from "../http";
import type {
  Bucket,
  BucketListResult,
  CreateBucketInput,
  CreateStorageAccessKeyInput,
  ObjectListQuery,
  ObjectListResult,
  PresignResult,
  StorageAccessKeyCreated,
  StorageAccessKeyItem,
  StorageObject,
  StorageStats,
  UpdateBucketInput,
  UpdateStorageAccessKeyInput,
  UploadResult,
} from "../types";

export class StorageResource {
  constructor(private http: HttpClient) {}

  // ── Buckets ─────────────────────────────────────────────────────────────────

  /** List all buckets */
  async listBuckets(): Promise<BucketListResult> {
    return this.http.get<BucketListResult>("/api/storage");
  }

  /** Create a new bucket */
  async createBucket(input: CreateBucketInput): Promise<Bucket> {
    return this.http.post<Bucket>("/api/storage/buckets", input);
  }

  /** Get bucket details */
  async getBucket(name: string): Promise<Bucket> {
    return this.http.get<Bucket>(`/api/storage/buckets/${name}`);
  }

  /** Update bucket (toggle public/private) */
  async updateBucket(name: string, input: UpdateBucketInput): Promise<Bucket> {
    return this.http.patch<Bucket>(`/api/storage/buckets/${name}`, input);
  }

  /** Delete a bucket */
  async deleteBucket(name: string, force = false): Promise<void> {
    const qs = force ? "?force=true" : "";
    await this.http.delete(`/api/storage/buckets/${name}${qs}`);
  }

  // ── Objects ─────────────────────────────────────────────────────────────────

  /** List objects in a bucket */
  async listObjects(bucket: string, query?: ObjectListQuery): Promise<ObjectListResult> {
    const params = new URLSearchParams();
    if (query?.prefix) params.set("prefix", query.prefix);
    if (query?.delimiter) params.set("delimiter", query.delimiter);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.search) params.set("search", query.search);
    const qs = params.toString();
    return this.http.get<ObjectListResult>(`/api/storage/buckets/${bucket}/objects${qs ? `?${qs}` : ""}`);
  }

  /** Upload a file to a bucket */
  async upload(bucket: string, key: string, file: File | Blob): Promise<UploadResult> {
    const encodedKey = encodeURIComponent(key);
    const contentType = file.type || "application/octet-stream";
    return this.http.requestBinary<UploadResult>("POST", `/api/storage/buckets/${bucket}/upload?key=${encodedKey}`, file, contentType);
  }

  /** Download a file (returns Response for streaming) */
  getDownloadUrl(bucket: string, key: string): string {
    return `/api/storage/buckets/${bucket}/objects/${key}`;
  }

  /** Update object metadata (toggle public) */
  async updateObject(bucket: string, key: string, input: { isPublic: boolean }): Promise<StorageObject> {
    return this.http.patch<StorageObject>(`/api/storage/buckets/${bucket}/objects/${key}`, input);
  }

  /** Delete an object */
  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.http.delete(`/api/storage/buckets/${bucket}/objects/${key}`);
  }

  /** Bulk delete objects */
  async bulkDelete(bucket: string, keys: string[]): Promise<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(`/api/storage/buckets/${bucket}/bulk-delete`, { keys });
  }

  /** Create a presigned URL for an object */
  async presignUrl(bucket: string, key: string, expiresIn = 3600): Promise<PresignResult> {
    return this.http.post<PresignResult>(`/api/storage/buckets/${bucket}/presign/${key}`, { expiresIn });
  }

  /** Get the public URL for an object */
  getPublicUrl(bucket: string, key: string): string {
    return `/public/${bucket}/${key}`;
  }

  // ── Access Keys ─────────────────────────────────────────────────────────────

  /** List all storage access keys */
  async listAccessKeys(): Promise<{ items: StorageAccessKeyItem[]; meta: { total: number } }> {
    return this.http.get("/api/storage/access-keys");
  }

  /** Create a new access key */
  async createAccessKey(input: CreateStorageAccessKeyInput): Promise<StorageAccessKeyCreated> {
    return this.http.post<StorageAccessKeyCreated>("/api/storage/access-keys", input);
  }

  /** Update an access key */
  async updateAccessKey(id: string, input: UpdateStorageAccessKeyInput): Promise<StorageAccessKeyItem> {
    return this.http.patch<StorageAccessKeyItem>(`/api/storage/access-keys/${id}`, input);
  }

  /** Delete an access key */
  async deleteAccessKey(id: string): Promise<void> {
    await this.http.delete(`/api/storage/access-keys/${id}`);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  /** Get storage statistics */
  async stats(): Promise<StorageStats> {
    return this.http.get<StorageStats>("/api/storage/stats");
  }
}
