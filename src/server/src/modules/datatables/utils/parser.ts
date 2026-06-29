/**
 * MQL (GomuStack Query Language) Parser
 *
 * A mini SQL-like DSL for querying Dynamic Table rows.
 * LLMs can write a single string like:
 *   "SELECT name, email WHERE city = 'HCM' AND age > 30 ORDER BY name LIMIT 10"
 *
 * Security:
 *   - MQL is NOT SQL. It's parsed into structured JS objects, then processed in-memory.
 *   - Table scope is determined by the URL path param — NOT from the MQL string.
 *   - Column names are validated against the table's column definitions.
 *   - Only SELECT/WHERE/ORDER BY/LIMIT/OFFSET/COUNT are supported.
 *   - DDL/DML keywords (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, EXEC) are REJECTED.
 *   - Semicolons, comments (--), and multi-statement inputs are REJECTED.
 */

// ── Types ───────────────────────────────────────────────────────────────────────

export type MqlOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "ilike"
  | "in"
  | "not_in"
  | "between"
  | "is_empty"
  | "is_not_empty";

export interface MqlCondition {
  column: string;
  op: MqlOperator;
  value?: unknown;
}

export interface MqlAndNode {
  and: MqlFilterNode[];
}

export interface MqlOrNode {
  or: MqlFilterNode[];
}

export type MqlFilterNode = MqlCondition | MqlAndNode | MqlOrNode;

export interface MqlSortRule {
  column: string;
  direction: "asc" | "desc";
}

export interface MqlResult {
  select?: string[];
  filters?: MqlFilterNode;
  sort?: MqlSortRule[];
  limit?: number;
  offset?: number;
  count?: boolean;
}

// ── Security: Banned keywords ───────────────────────────────────────────────────

const BANNED_KEYWORDS = [
  "DROP",
  "DELETE",
  "UPDATE",
  "INSERT",
  "ALTER",
  "TRUNCATE",
  "EXEC",
  "EXECUTE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "UNION",
  "INTO",
  "SET",
  "CALL",
  "MERGE",
  "REPLACE",
  "LOAD",
  "COPY",
];

function sanitize(query: string): void {
  // Reject semicolons (multi-statement)
  if (query.includes(";")) {
    throw new MqlParseError("Semicolons are not allowed");
  }
  // Reject SQL comments
  if (query.includes("--") || query.includes("/*") || query.includes("*/")) {
    throw new MqlParseError("SQL comments are not allowed");
  }
  // Reject banned keywords (whole word match, case-insensitive)
  const upper = query.toUpperCase();
  for (const kw of BANNED_KEYWORDS) {
    // Match whole word: keyword must be at boundary
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(upper)) {
      throw new MqlParseError(`Keyword "${kw}" is not allowed in MQL`);
    }
  }
}

// ── Error class ─────────────────────────────────────────────────────────────────

export class MqlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MqlParseError";
  }
}

// ── Tokenizer ───────────────────────────────────────────────────────────────────

type TokenType =
  | "KEYWORD"    // SELECT, WHERE, AND, OR, NOT, ORDER, BY, LIMIT, OFFSET, ASC, DESC, IN, BETWEEN, IS, NULL, LIKE, COUNT
  | "IDENT"      // column name
  | "STRING"     // 'value' or "value"
  | "NUMBER"     // 123, 12.5
  | "BOOL"       // true, false
  | "OP"         // =, !=, <>, >, >=, <, <=
  | "COMMA"      // ,
  | "LPAREN"     // (
  | "RPAREN"     // )
  | "STAR"       // *
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  "SELECT", "WHERE", "AND", "OR", "NOT", "ORDER", "BY",
  "LIMIT", "OFFSET", "ASC", "DESC", "IN", "BETWEEN",
  "IS", "NULL", "LIKE", "COUNT", "GROUP",
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) { i++; continue; }

    const pos = i;

    // String literals: 'xxx' or "xxx"
    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i];
      i++;
      let val = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          val += input[i];
        } else {
          val += input[i];
        }
        i++;
      }
      if (i >= input.length) throw new MqlParseError(`Unterminated string at position ${pos}`);
      i++; // skip closing quote
      tokens.push({ type: "STRING", value: val, pos });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(input[i]) || (input[i] === "-" && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      let num = input[i];
      i++;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: num, pos });
      continue;
    }

    // Operators: !=, <>, >=, <=, =, >, <
    if (input[i] === "!" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "!=", pos });
      i += 2;
      continue;
    }
    if (input[i] === "<" && input[i + 1] === ">") {
      tokens.push({ type: "OP", value: "!=", pos });
      i += 2;
      continue;
    }
    if (input[i] === ">" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: ">=", pos });
      i += 2;
      continue;
    }
    if (input[i] === "<" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "<=", pos });
      i += 2;
      continue;
    }
    if (input[i] === "=") { tokens.push({ type: "OP", value: "=", pos }); i++; continue; }
    if (input[i] === ">") { tokens.push({ type: "OP", value: ">", pos }); i++; continue; }
    if (input[i] === "<") { tokens.push({ type: "OP", value: "<", pos }); i++; continue; }

    // Punctuation
    if (input[i] === ",") { tokens.push({ type: "COMMA", value: ",", pos }); i++; continue; }
    if (input[i] === "(") { tokens.push({ type: "LPAREN", value: "(", pos }); i++; continue; }
    if (input[i] === ")") { tokens.push({ type: "RPAREN", value: ")", pos }); i++; continue; }
    if (input[i] === "*") { tokens.push({ type: "STAR", value: "*", pos }); i++; continue; }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(input[i])) {
      let word = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        word += input[i];
        i++;
      }
      const upper = word.toUpperCase();
      if (upper === "TRUE" || upper === "FALSE") {
        tokens.push({ type: "BOOL", value: upper === "TRUE" ? "true" : "false", pos });
      } else if (KEYWORDS.has(upper)) {
        tokens.push({ type: "KEYWORD", value: upper, pos });
      } else {
        tokens.push({ type: "IDENT", value: word, pos });
      }
      continue;
    }

    throw new MqlParseError(`Unexpected character '${input[i]}' at position ${i}`);
  }

  tokens.push({ type: "EOF", value: "", pos: i });
  return tokens;
}

// ── Parser ──────────────────────────────────────────────────────────────────────

class MqlParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: "EOF", value: "", pos: -1 };
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new MqlParseError(
        `Expected ${type}${value ? ` '${value}'` : ""} but got ${t.type} '${t.value}' at position ${t.pos}`,
      );
    }
    return this.advance();
  }

  private isKeyword(kw: string): boolean {
    const t = this.peek();
    return t.type === "KEYWORD" && t.value === kw;
  }

  // ── Main parse ──

  parse(): MqlResult {
    const result: MqlResult = {};

    // Handle COUNT
    if (this.isKeyword("COUNT")) {
      this.advance();
      result.count = true;
    }

    // Handle SELECT
    if (this.isKeyword("SELECT")) {
      this.advance();
      result.select = this.parseSelectList();
    }

    // Handle WHERE
    if (this.isKeyword("WHERE")) {
      this.advance();
      result.filters = this.parseOrExpr();
    }

    // Handle ORDER BY
    if (this.isKeyword("ORDER")) {
      this.advance();
      this.expect("KEYWORD", "BY");
      result.sort = this.parseOrderByList();
    }

    // Handle LIMIT
    if (this.isKeyword("LIMIT")) {
      this.advance();
      const numToken = this.expect("NUMBER");
      result.limit = parseInt(numToken.value, 10);
      if (Number.isNaN(result.limit) || result.limit < 0) {
        throw new MqlParseError("LIMIT must be a non-negative integer");
      }
    }

    // Handle OFFSET
    if (this.isKeyword("OFFSET")) {
      this.advance();
      const numToken = this.expect("NUMBER");
      result.offset = parseInt(numToken.value, 10);
      if (Number.isNaN(result.offset) || result.offset < 0) {
        throw new MqlParseError("OFFSET must be a non-negative integer");
      }
    }

    // Should be at EOF
    if (this.peek().type !== "EOF") {
      const t = this.peek();
      throw new MqlParseError(`Unexpected token '${t.value}' at position ${t.pos}`);
    }

    return result;
  }

  // ── SELECT clause ──

  private parseSelectList(): string[] {
    const cols: string[] = [];

    // SELECT * means all
    if (this.peek().type === "STAR") {
      this.advance();
      return []; // empty = all columns
    }

    cols.push(this.parseColumnName());
    while (this.peek().type === "COMMA") {
      this.advance();
      cols.push(this.parseColumnName());
    }
    return cols;
  }

  private parseColumnName(): string {
    const t = this.peek();
    if (t.type === "IDENT") {
      this.advance();
      return t.value;
    }
    // Allow keywords as column names (e.g. "order", "select")
    if (t.type === "KEYWORD") {
      this.advance();
      return t.value.toLowerCase();
    }
    throw new MqlParseError(`Expected column name but got '${t.value}' at position ${t.pos}`);
  }

  // ── WHERE clause — recursive descent for AND/OR/parentheses ──

  private parseOrExpr(): MqlFilterNode {
    let left = this.parseAndExpr();

    while (this.isKeyword("OR")) {
      this.advance();
      const right = this.parseAndExpr();
      // Flatten nested ORs
      if ("or" in left) {
        (left as MqlOrNode).or.push(right);
      } else {
        left = { or: [left, right] };
      }
    }

    return left;
  }

  private parseAndExpr(): MqlFilterNode {
    let left = this.parseCondition();

    while (this.isKeyword("AND")) {
      this.advance();
      const right = this.parseCondition();
      // Flatten nested ANDs
      if ("and" in left) {
        (left as MqlAndNode).and.push(right);
      } else {
        left = { and: [left, right] };
      }
    }

    return left;
  }

  private parseCondition(): MqlFilterNode {
    // Grouped expression: (...)
    if (this.peek().type === "LPAREN") {
      this.advance();
      const expr = this.parseOrExpr();
      this.expect("RPAREN");
      return expr;
    }

    // NOT condition
    if (this.isKeyword("NOT")) {
      this.advance();
      const inner = this.parseCondition();
      // Invert the condition
      if ("op" in inner) {
        return this.negateCondition(inner);
      }
      throw new MqlParseError("NOT can only be applied to a simple condition");
    }

    // Simple condition: column OP value
    return this.parseSimpleCondition();
  }

  private negateCondition(cond: MqlCondition): MqlCondition {
    const negMap: Record<string, MqlOperator> = {
      eq: "neq", neq: "eq",
      gt: "lte", gte: "lt",
      lt: "gte", lte: "gt",
      contains: "not_contains", not_contains: "contains",
      in: "not_in", not_in: "in",
      is_empty: "is_not_empty", is_not_empty: "is_empty",
      ilike: "not_contains", // approximate negation
    };
    const negOp = negMap[cond.op];
    if (!negOp) throw new MqlParseError(`Cannot negate operator '${cond.op}'`);
    return { ...cond, op: negOp };
  }

  private parseSimpleCondition(): MqlCondition {
    const column = this.parseColumnName();

    // IS NULL / IS NOT NULL
    if (this.isKeyword("IS")) {
      this.advance();
      if (this.isKeyword("NOT")) {
        this.advance();
        this.expect("KEYWORD", "NULL");
        return { column, op: "is_not_empty" };
      }
      this.expect("KEYWORD", "NULL");
      return { column, op: "is_empty" };
    }

    // NOT IN / NOT LIKE / NOT BETWEEN
    if (this.isKeyword("NOT")) {
      this.advance();
      if (this.isKeyword("IN")) {
        this.advance();
        const values = this.parseValueList();
        return { column, op: "not_in", value: values };
      }
      if (this.isKeyword("LIKE")) {
        this.advance();
        const pattern = this.parseLikePattern();
        return { column, op: "not_contains", value: pattern };
      }
      if (this.isKeyword("BETWEEN")) {
        throw new MqlParseError("NOT BETWEEN is not supported; use < and > instead");
      }
      throw new MqlParseError(`Unexpected NOT at position ${this.peek().pos}`);
    }

    // IN (...)
    if (this.isKeyword("IN")) {
      this.advance();
      const values = this.parseValueList();
      return { column, op: "in", value: values };
    }

    // BETWEEN x AND y
    if (this.isKeyword("BETWEEN")) {
      this.advance();
      const low = this.parseScalar();
      this.expect("KEYWORD", "AND");
      const high = this.parseScalar();
      return { column, op: "between", value: [low, high] };
    }

    // LIKE 'pattern'
    if (this.isKeyword("LIKE")) {
      this.advance();
      const pattern = this.parseLikePattern();
      return this.likeToCondition(column, pattern);
    }

    // Standard operators: =, !=, <>, >, >=, <, <=
    const opToken = this.expect("OP");
    const value = this.parseScalar();

    const opMap: Record<string, MqlOperator> = {
      "=": "eq", "!=": "neq",
      ">": "gt", ">=": "gte",
      "<": "lt", "<=": "lte",
    };

    const op = opMap[opToken.value];
    if (!op) throw new MqlParseError(`Unknown operator '${opToken.value}'`);

    return { column, op, value };
  }

  private likeToCondition(column: string, pattern: string): MqlCondition {
    // %xxx% → contains
    if (pattern.startsWith("%") && pattern.endsWith("%")) {
      return { column, op: "contains", value: pattern.slice(1, -1) };
    }
    // %xxx → ends_with
    if (pattern.startsWith("%")) {
      return { column, op: "ends_with", value: pattern.slice(1) };
    }
    // xxx% → starts_with
    if (pattern.endsWith("%")) {
      return { column, op: "starts_with", value: pattern.slice(0, -1) };
    }
    // exact match
    return { column, op: "ilike", value: pattern };
  }

  private parseLikePattern(): string {
    const t = this.expect("STRING");
    return t.value;
  }

  // ── Value parsing ──

  private parseScalar(): unknown {
    const t = this.peek();
    if (t.type === "STRING") { this.advance(); return t.value; }
    if (t.type === "NUMBER") { this.advance(); return Number(t.value); }
    if (t.type === "BOOL") { this.advance(); return t.value === "true"; }
    if (t.type === "KEYWORD" && t.value === "NULL") { this.advance(); return null; }
    throw new MqlParseError(`Expected value but got '${t.value}' at position ${t.pos}`);
  }

  private parseValueList(): unknown[] {
    this.expect("LPAREN");
    const values: unknown[] = [];
    values.push(this.parseScalar());
    while (this.peek().type === "COMMA") {
      this.advance();
      values.push(this.parseScalar());
    }
    this.expect("RPAREN");
    return values;
  }

  // ── ORDER BY clause ──

  private parseOrderByList(): MqlSortRule[] {
    const rules: MqlSortRule[] = [];
    rules.push(this.parseOrderByItem());
    while (this.peek().type === "COMMA") {
      this.advance();
      rules.push(this.parseOrderByItem());
    }
    return rules;
  }

  private parseOrderByItem(): MqlSortRule {
    const column = this.parseColumnName();
    let direction: "asc" | "desc" = "asc";
    if (this.isKeyword("ASC")) { this.advance(); direction = "asc"; }
    else if (this.isKeyword("DESC")) { this.advance(); direction = "desc"; }
    return { column, direction };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Parse an MQL query string into a structured MqlResult.
 *
 * @param query - MQL query string, e.g. "SELECT name WHERE age > 25 ORDER BY name LIMIT 10"
 * @returns Parsed MqlResult with select, filters, sort, limit, offset, count
 * @throws MqlParseError on invalid/dangerous input
 *
 * @example
 * parseMql("WHERE city = 'HCM' AND age > 30 ORDER BY name LIMIT 10")
 * parseMql("SELECT name, email WHERE active = true")
 * parseMql("COUNT WHERE status = 'active'")
 * parseMql("WHERE age BETWEEN 20 AND 35")
 * parseMql("WHERE city IN ('HCM', 'Hanoi')")
 */
export function parseMql(query: string): MqlResult {
  if (!query || typeof query !== "string") {
    throw new MqlParseError("Query must be a non-empty string");
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) return {};
  if (trimmed === "*") return {};

  // Security check
  sanitize(trimmed);

  // Tokenize & parse
  const tokens = tokenize(trimmed);
  const parser = new MqlParser(tokens);
  return parser.parse();
}
