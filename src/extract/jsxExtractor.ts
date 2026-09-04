import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { Config } from "../config/schema.js";
import type { CopyString, ExtractionResult } from "./types.js";

// @babel/traverse's default export is wrapped differently depending on how
// the CJS/ESM interop shakes out at bundle time. Normalize it once here.
const traverse: typeof traverseModule =
  typeof traverseModule === "function" ? traverseModule : (traverseModule as any).default;

const MIN_MEANINGFUL_LENGTH = 2;

function isLikelyCopy(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_MEANINGFUL_LENGTH) return false;
  // Skip pure punctuation, numbers, single symbols, and template-only whitespace.
  if (/^[\s\d.,:;!?%$#@/\\|_+=*-]*$/.test(trimmed)) return false;
  // Skip things that look like CSS classnames, ids, or code identifiers (no spaces, camelCase/kebab only)
  // but only when short - short identifiers are almost never real copy.
  if (trimmed.length < 4 && /^[a-zA-Z0-9_-]+$/.test(trimmed) && !/[A-Z].*[a-z]| /.test(trimmed)) {
    return false;
  }
  return true;
}

function calleeName(node: t.CallExpression): string | null {
  const callee = node.callee;
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee) && !callee.computed) {
    const objectName = t.isIdentifier(callee.object) ? callee.object.name : null;
    const propName = t.isIdentifier(callee.property) ? callee.property.name : null;
    if (objectName && propName) return `${objectName}.${propName}`;
    return propName;
  }
  return null;
}

export function extractFromSource(file: string, source: string, config: Config): ExtractionResult {
  const strings: CopyString[] = [];

  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "decorators-legacy",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator"
      ]
    });
  } catch (err) {
    // Unparseable file: skip it rather than crash the whole scan.
    return { file, originalContent: source, strings: [] };
  }

  const lineAt = (index: number): number => source.slice(0, index).split("\n").length;

  traverse(ast, {
    JSXText(path: NodePath<t.JSXText>) {
      if (!config.targets.jsxText) return;
      const node = path.node;
      if (typeof node.start !== "number" || typeof node.end !== "number") return;
      const raw = node.value;
      const trimmed = raw.trim();
      if (!isLikelyCopy(trimmed)) return;

      const leading = raw.indexOf(trimmed);
      const start = node.start + leading;
      const end = start + trimmed.length;

      strings.push({
        file,
        line: lineAt(start),
        start,
        end,
        text: trimmed,
        kind: "jsx-text",
        context: "jsx"
      });
    },

    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      const node = path.node;
      const name = t.isJSXIdentifier(node.name) ? node.name.name : null;
      if (!name || !config.targets.attributes.includes(name)) return;

      let literal: t.StringLiteral | null = null;
      if (t.isStringLiteral(node.value)) {
        literal = node.value;
      } else if (
        t.isJSXExpressionContainer(node.value) &&
        t.isStringLiteral(node.value.expression)
      ) {
        literal = node.value.expression;
      }
      if (!literal || typeof literal.start !== "number" || typeof literal.end !== "number") return;
      if (!isLikelyCopy(literal.value)) return;

      const quoteChar = source[literal.start] as '"' | "'";
      strings.push({
        file,
        line: lineAt(literal.start),
        start: literal.start + 1,
        end: literal.end - 1,
        text: literal.value,
        kind: "jsx-attribute",
        context: name,
        quote: quoteChar
      });
    },

    CallExpression(path: NodePath<t.CallExpression>) {
      const node = path.node;
      const name = calleeName(node);
      if (!name || !config.targets.callees.includes(name)) return;
      const firstArg = node.arguments[0];
      if (!firstArg || !t.isStringLiteral(firstArg)) return;
      if (typeof firstArg.start !== "number" || typeof firstArg.end !== "number") return;
      if (!isLikelyCopy(firstArg.value)) return;

      const quoteChar = source[firstArg.start] as '"' | "'";
      strings.push({
        file,
        line: lineAt(firstArg.start),
        start: firstArg.start + 1,
        end: firstArg.end - 1,
        text: firstArg.value,
        kind: "call-argument",
        context: name,
        quote: quoteChar
      });
    }
  });

  return { file, originalContent: source, strings };
}
