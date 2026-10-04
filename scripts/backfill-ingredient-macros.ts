/**
 * One-off backfill: ingredients with all-null macro fields (created as manual
 * placeholders before auto-match started skipping them, see e7cda69 follow-up)
 * are re-queried against OFF by name and updated in place when a match is found.
 *
 * Usage: pnpm tsx scripts/backfill-ingredient-macros.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { searchOff } from '../src/lib/off';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)');
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(url, serviceKey);

async function main() {
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, name')
    .is('kcal_per_100g', null)
    .is('protein_per_100g', null)
    .is('fat_per_100g', null)
    .is('carbs_per_100g', null);

  if (error) throw error;
  if (!ingredients?.length) {
    console.log('No null-macro ingredients found.');
    return;
  }

  console.log(`Found ${ingredients.length} null-macro ingredients.`);

  let updated = 0;
  let stillMissing = 0;

  for (const row of ingredients) {
    const matches = await searchOff(row.name).catch(() => []);
    const match = matches[0];
    if (!match) {
      stillMissing++;
      console.log(`  no OFF match: "${row.name}"`);
      continue;
    }

    console.log(`  ${dryRun ? '[dry-run] would update' : 'updating'} "${row.name}" -> ${match.kcal_per_100g} kcal/100g`);
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('ingredients')
        .update({
          kcal_per_100g: match.kcal_per_100g,
          protein_per_100g: match.protein_per_100g,
          fat_per_100g: match.fat_per_100g,
          carbs_per_100g: match.carbs_per_100g,
          source: 'off',
        })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${stillMissing} still missing (no OFF match — needs manual entry).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
