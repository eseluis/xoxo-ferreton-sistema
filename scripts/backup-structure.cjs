const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const backupDirectory = path.join(projectRoot, "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDirectory, `estructura-${timestamp}.json`);
const exported = execFileSync(process.execPath, [path.join(__dirname, "export-structure.cjs")], {
  cwd: projectRoot,
  encoding: "utf8",
});

fs.mkdirSync(backupDirectory, { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(JSON.parse(exported), null, 2)}\n`, "utf8");
process.stdout.write(`${destination}\n`);
