import { NewRecipeScreen } from '@/components/import/NewRecipeScreen';

/** `?import=1` opens the import dialog straight away (the „Importuj z URL" action on the recipe list). */
export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string | string[] }>;
}) {
  const { import: importParam } = await searchParams;
  return <NewRecipeScreen startWithImport={importParam === '1'} />;
}
