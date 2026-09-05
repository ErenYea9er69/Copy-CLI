export type CandidateSource = "jsx-text" | "jsx-attribute" | "call-argument" | "object-property" | "json-value";

export interface StringCandidate {
  id: string;
  file: string;
  /** Byte offset in the original file text where the replaceable content starts. */
  start: number;
  /** Byte offset where it ends (exclusive). */
  end: number;
  line: number;
  column: number;
  /** The raw string value, unescaped, as a human would read it. */
  value: string;
  /** Where the string was found, for the model's context and for filtering. */
  source: CandidateSource;
  /** Attribute name, call callee name, or object key name, when known. */
  contextName?: string;
  /** A short snippet of surrounding code for the model's context. */
  contextSnippet: string;
}

export interface RuleViolation {
  rule: string;
  detail: string;
  severity: "error" | "warning";
}

export interface RewriteResult {
  candidate: StringCandidate;
  rewrite: string;
  rationale: string;
  attempts: number;
  status: "ok" | "needs_review" | "unchanged" | "failed";
  errors: RuleViolation[];
  warnings: RuleViolation[];
  /** Inferred psychological role (cta, error, headline, ...); see rules/psychology.ts. */
  role?: string;
  /** Heuristic 0-100 clarity score of the original string, for comparison. */
  scoreBefore?: number;
  /** Heuristic 0-100 clarity score of the rewrite. */
  scoreAfter?: number;
}
