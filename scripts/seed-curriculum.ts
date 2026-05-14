import { importiereCurriculum } from "@/lib/curriculum/import";
import { sqlClient } from "@/lib/db";

async function main() {
  console.log("Importiere alle Lehrpläne aus data/lehrplan/curriculum.json …");
  const ergebnisse = await importiereCurriculum();
  for (const e of ergebnisse) {
    console.log(`✓ ${e.titel} (slug=${e.slug})`);
    for (const k of e.klassen) {
      console.log(
        `  Klasse ${k.klasse}: +${k.neueKompetenzen} Kompetenzen, +${k.neueAnwendungsbereiche} Anwendungsbereiche (${k.bereiche} Bereiche)`,
      );
    }
  }
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
