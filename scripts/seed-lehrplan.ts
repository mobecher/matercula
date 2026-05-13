import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const folder = path.join(process.cwd(), "data", "lehrplan");
  const files = await fs.readdir(folder);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  console.log(`Found ${jsonFiles.length} Lehrplan JSON file(s).`);
  console.log("Import stub is ready. Implement domain-specific mapping in a follow-up change.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
