const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/data.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const dataModule = new Module(filename, module);
dataModule.filename = filename;
dataModule.paths = Module._nodeModulePaths(path.dirname(filename));
dataModule._compile(output, filename);

const { defaultEmployees, defaultShiftConfigs, defaultActivitySchedules, defaultCleaningRole } = dataModule.exports;
process.stdout.write(JSON.stringify({
  "xoxo.collaborators": defaultEmployees,
  "xoxo.shiftConfigs": defaultShiftConfigs,
  "xoxo.activitySchedules": defaultActivitySchedules,
  "xoxo.cleaningRole": defaultCleaningRole,
}));
