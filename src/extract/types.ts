export type SourceKind = "jsx-text" | "jsx-attribute" | "call-argument" | "json-value";

export interface CopyString {
  /** Absolute file path this string came from. */
  file: string;
  /** 1-based line number, for human-readable output. */
  line: number;
  /** Byte offsets into the original file content, used for safe splicing. */
  start: number;
  end: number;
  /** The raw text content, without surrounding quotes. */
  text: string;
  /** Where the string was found, for reporting and rule selection. */
  kind: SourceKind;
  /** Extra context: attribute name, callee name, or JSON key path. */
  context: string;
  /** Quote character to reconstruct the token on write-back. Undefined for JSX text. */
  quote?: '"' | "'" | "`";
}

export interface ExtractionResult {
  file: string;
  originalContent: string;
  strings: CopyString[];
}
