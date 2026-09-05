import { parse } from "@babel/parser";
// @babel/traverse ships as CJS; under NodeNext + esModuleInterop the default
// import sometimes resolves to the module namespace instead of the function
// itself, depending on the installed version. Normalize it at runtime and
// give it an explicit callable type rather than fighting the module's own
// (occasionally inconsistent) type declarations.
import * as traverseNs from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { nanoid } from "nanoid";
import type { StringCandidate, CandidateSource } from "./types.js";
import type { Config } from "../config.js";

type TraverseFn = (ast: t.Node, visitor: Record<string, (path: any) => void>) => void;
// Node's ESM interop for this package can land the callable in one of a few
// spots depending on how it was built. Walk the likely candidates instead of
// guessing one and breaking on a version bump.
function resolveTraverse(mod: any): TraverseFn {
  for (const candidate of [mod?.default?.default, mod?.default, mod]) {
    if (typeof candidate === "function") return candidate;
  }
  throw new Error("could not resolve a callable export from @babel/traverse");
}
const traverse = resolveTraverse(traverseNs);

/** Strings that are almost never prose: paths, CSS-ish tokens, empty, single char, pure punctuation. */
function looksTechnical(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return true;
  if (/^[a-z0-9\-_./:#]+$/.test(trimmed) && !/\s/.test(trimmed)) return true; // slug/path/class-like
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^[A-Z0-9_]+$/.test(trimmed)) return true; // CONST_NAME-like
  return false;
}

function snippet(source: string, start: number, end: number): string {
  const lineStart = source.lastIndexOf("\n", start) + 1;
  const lineEnd = source.indexOf("\n", end);
  return source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim().slice(0, 200);
}

function calleeName(node: t.CallExpression): string {
  const callee = node.callee;
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    const objectName = t.isIdentifier(callee.object) ? callee.object.name : "";
    return objectName ? `${objectName}.${callee.property.name}` : callee.property.name;
  }
  return "";
}

export function extractFromSource(source: string, filePath: string, config: Config): StringCandidate[] {
  const candidates: StringCandidate[] = [];
  const isTs = /\.tsx?$/.test(filePath);

  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: [
        "jsx",
        ...(isTs ? (["typescript"] as const) : []),
        "classProperties",
        "decorators-legacy",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
      errorRecovery: true,
    });
  } catch {
    // Not parseable as JS/TS (could be a stray file matched by a broad glob). Skip quietly.
    return [];
  }

  const attrAllow = new Set(config.attribute_allowlist.map((a) => a.toLowerCase()));
  const keyAllow = new Set(config.key_allowlist.map((k) => k.toLowerCase()));
  const callAllow = new Set(config.call_allowlist);

  function push(value: string, start: number, end: number, source_: CandidateSource, contextName?: string) {
    if (looksTechnical(value)) return;
    const before = source.slice(0, start);
    const line = before.split("\n").length;
    const column = start - before.lastIndexOf("\n");
    candidates.push({
      id: nanoid(10),
      file: filePath,
      start,
      end,
      line,
      column,
      value,
      source: source_,
      contextName,
      contextSnippet: snippet(source, start, end),
    });
  }

  traverse(ast, {
    JSXText(path: NodePath<t.JSXText>) {
      const raw = path.node.value;
      if (raw.trim().length === 0) return;
      // Trim surrounding whitespace/newlines from the replaceable range so
      // indentation in the JSX source is left untouched.
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;
      const start = (path.node.start ?? 0) + leading;
      const end = (path.node.end ?? 0) - trailing;
      // The enclosing tag name is the closest thing this candidate has to
      // a "key": a <button> or <h1> tells the role-inference step what
      // job the text is doing even though JSX text carries no attribute
      // name of its own.
      const enclosingElement = path.findParent((p) => p.isJSXElement());
      let tagName: string | undefined;
      if (enclosingElement?.isJSXElement()) {
        const opening = enclosingElement.node.openingElement.name;
        if (t.isJSXIdentifier(opening)) tagName = opening.name;
      }
      push(raw.trim(), start, end, "jsx-text", tagName);
    },
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      const name = t.isJSXIdentifier(path.node.name) ? path.node.name.name : "";
      if (!attrAllow.has(name.toLowerCase())) return;
      const value = path.node.value;
      if (t.isStringLiteral(value) && value.start != null && value.end != null) {
        // start/end include the surrounding quotes; narrow by one char each side.
        push(value.value, value.start + 1, value.end - 1, "jsx-attribute", name);
      }
    },
    ObjectProperty(path: NodePath<t.ObjectProperty>) {
      const key = path.node.key;
      const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : "";
      if (!keyName || !keyAllow.has(keyName.toLowerCase())) return;
      const value = path.node.value;
      if (t.isStringLiteral(value) && value.start != null && value.end != null) {
        push(value.value, value.start + 1, value.end - 1, "object-property", keyName);
      }
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      const name = calleeName(path.node);
      if (!name || !callAllow.has(name)) return;
      const firstArg = path.node.arguments[0];
      if (firstArg && t.isStringLiteral(firstArg) && firstArg.start != null && firstArg.end != null) {
        push(firstArg.value, firstArg.start + 1, firstArg.end - 1, "call-argument", name);
      }
    },
  });

  return candidates;
}
