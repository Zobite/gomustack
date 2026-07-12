import { describe, test, expect } from "bun:test";
import { parseMql, MqlParseError } from "./parser.js";

describe("parseMql", () => {
  test("parses select where order limit", () => {
    const result = parseMql("SELECT name, email WHERE city = 'HCM' AND age > 30 ORDER BY name LIMIT 10");
    expect(result.select).toEqual(["name", "email"]);
    expect(result.limit).toBe(10);
    expect(result.sort?.[0]).toEqual({ column: "name", direction: "asc" });
    expect(result.filters).toBeDefined();
  });

  test("parses COUNT and IN", () => {
    const result = parseMql("COUNT WHERE status IN ('a', 'b')");
    expect(result.count).toBe(true);
    expect(result.filters).toMatchObject({
      column: "status",
      op: "in",
      value: ["a", "b"],
    });
  });

  test("rejects banned DDL keywords", () => {
    expect(() => parseMql("DROP TABLE users")).toThrow(MqlParseError);
    expect(() => parseMql("DELETE FROM users")).toThrow(MqlParseError);
    expect(() => parseMql("WHERE x = 1; DROP TABLE t")).toThrow(MqlParseError);
  });

  test("rejects comments and semicolons", () => {
    expect(() => parseMql("WHERE a = 1 -- comment")).toThrow(MqlParseError);
    expect(() => parseMql("WHERE a = 1; WHERE b = 2")).toThrow(MqlParseError);
  });

  test("star query returns empty result", () => {
    expect(parseMql("*")).toEqual({});
  });

  test("rejects empty query", () => {
    expect(() => parseMql("")).toThrow(MqlParseError);
  });
});
