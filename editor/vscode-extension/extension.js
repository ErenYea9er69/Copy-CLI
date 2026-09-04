// Minimal CopyShed extension skeleton.
//
// This does not call into copyshed's TypeScript internals directly. It
// shells out to the same CLI documented in the main README, the same way a
// pre-commit hook or CI job would. That keeps the extension thin and keeps
// exactly one implementation of the extraction/rewrite/apply logic to
// maintain and test.
//
// To try this locally: open this folder in VS Code, press F5 to launch an
// Extension Development Host, then open a project with a copyshed.config.json.

const vscode = require("vscode");
const { execFile } = require("node:child_process");
const path = require("node:path");

let outputChannel;

function getCliPath() {
  return vscode.workspace.getConfiguration("copyshed").get("cliPath", "copyshed");
}

function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(getCliPath(), args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // copyshed exits non-zero for lint failures, which is expected and not
      // itself an execution error, so we always resolve with both streams.
      resolve({ code: err ? err.code ?? 1 : 0, stdout, stderr });
    });
  });
}

async function previewFile(uri) {
  const filePath = uri.fsPath;
  const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(filePath);

  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine(`Previewing copy rewrites for ${path.relative(cwd, filePath)}...\n`);

  const { stdout, stderr, code } = await runCli(["scan", "--file", filePath], cwd);
  outputChannel.append(stdout);
  if (stderr) outputChannel.append(stderr);
  if (code !== 0) {
    vscode.window.showWarningMessage("copyshed scan exited with an error. See the CopyShed output panel.");
  }
}

async function applyFile(uri) {
  const filePath = uri.fsPath;
  const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(filePath);

  const { stdout, stderr, code } = await runCli(["apply", "--yes", "--file", filePath], cwd);
  outputChannel.appendLine(`\nApplying copy rewrites to ${path.relative(cwd, filePath)}...`);
  outputChannel.append(stdout);
  if (stderr) outputChannel.append(stderr);

  if (code === 0) {
    vscode.window.showInformationMessage("CopyShed: rewrites applied.");
  } else {
    vscode.window.showWarningMessage("copyshed apply exited with an error. See the CopyShed output panel.");
  }
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("CopyShed");

  context.subscriptions.push(
    vscode.commands.registerCommand("copyshed.previewFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) previewFile(editor.document.uri);
    }),
    vscode.commands.registerCommand("copyshed.applyFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) applyFile(editor.document.uri);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const applyOnSave = vscode.workspace.getConfiguration("copyshed").get("applyOnSave", false);
      if (!applyOnSave) return;
      const supported = ["typescriptreact", "javascriptreact", "typescript", "javascript", "json"];
      if (!supported.includes(doc.languageId)) return;
      applyFile(doc.uri);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
