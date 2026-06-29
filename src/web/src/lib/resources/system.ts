import type { HttpClient } from "../http";

export class SystemResource {
  constructor(private http: HttpClient) {}

  getVersion(): Promise<{ version: string }> {
    return this.http.get<{ version: string }>("/api/system/version");
  }
}
