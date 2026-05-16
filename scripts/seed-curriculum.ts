import { importCurriculum } from "@/lib/curriculum/import";
import { sqlClient } from "@/lib/db";

async function main() {
  console.log("Importiere alle Lehrpläne aus data/lehrplan/curriculum.json …");
  const results = await importCurriculum();
  for (const e of results) {
    console.log(`✓ ${e.title} (slug=${e.slug})`);
    for (const k of e.klassen) {
      console.log(
        `  Klasse ${k.klasse}: +${k.newKompetenzen} Kompetenzen, +${k.newAnwendungsbereiche} Anwendungsbereiche (${k.bereiche} Bereiche)`,
      );
    }
  }
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
