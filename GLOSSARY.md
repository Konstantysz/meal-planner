# Meal Planner

A PWA for planning a household's meals: a recipe database, recipe import from web pages, a weekly plan, and a shopping list derived from the plan. The code is in English; the UI is in Polish. Where a Polish UI string helps, it is noted as `UI: „…"`.

## Language

### Household and access

**Household**:
The unit that owns all recipes and plans. Each user reaches data only through their memberships in a household. UI: „gospodarstwo".
_Avoid_: account, family, tenant

**Membership**:
The link between a user and a household, carrying a role: owner or regular member.
_Avoid_: member row, access

**Owner**:
The member whose role is owner, the one who created the household. An owner can remove other members; the owner cannot remove themselves.
_Avoid_: admin, creator

**Member**:
Any person who belongs to a household, the owner included. A member who joined by invitation can use the household's data and remove only their own membership.
_Avoid_: user (for a membership), household member

**Visibility**:
Who may read a recipe: `private`, `household`, or `public_link`. In practice every recipe is `household`.
_Avoid_: privacy, sharing level, public

**Share link**:
A public, read-only URL that shows one plan's week to anyone holding it, with no login. It is the thing a user copies and sends.
_Avoid_: public link (a recipe visibility value, unrelated), share page (for the share link), shared plan (for the share link)

**Share token**:
The unguessable secret inside a share link that identifies the one plan it unlocks. Tokens do not expire.
_Avoid_: share key, share code, link id, link (for the secret itself)

### Recipes and ingredients

**Recipe**:
A household's dish, made of recipe ingredients and ordered steps, with base servings and optional prep time.
_Avoid_: dish, meal (a meal is what a slot holds), przepis (code and UI only)

**Ingredient**:
A catalogue entry, shared across all households, with macros per 100 g. Any signed-in user can add or edit one.
_Avoid_: product (an Open Food Facts term), food, item

**Recipe ingredient**:
An ingredient as used in one recipe: its amount, unit, and the original text it was entered or imported as.
_Avoid_: ingredient line (for the recipe ingredient), component, row

**Base servings**:
The number of servings a recipe's ingredient amounts produce. It is the denominator when amounts are scaled.
_Avoid_: yield, serves, portions

**Planned servings**:
The number of servings a slot is planned for, or the target count when scaling a recipe.
_Avoid_: servings (alone, when it could mean base servings), portions (UI "porcje" only)

**Yield**:
The raw servings text as it appears on an imported page, before it is parsed into base servings.
_Avoid_: servings (for the unparsed text)

**Scaling**:
Adjusting a recipe ingredient's amount from base servings to a different number of servings.
_Avoid_: converting (scaling does not change units)

**Macros**:
The four nutrition values per quantity: kcal, protein, fat and carbs. In the UI they are shown as kcal, B (białko, protein), T (tłuszcz, fat) and W (węglowodany, carbs). When no macro data exists for a total, the UI shows „brak danych makro".
_Avoid_: nutrition, nutrients, nutrition facts

**Macro source**:
Where an ingredient's macros came from: Open Food Facts, manual entry, or an AI estimate.
_Avoid_: origin, provenance

**Placeholder ingredient**:
An ingredient created with only a name and no macros, either by hand while building a recipe or as the fallback during import.
_Avoid_: bare ingredient, stub, manual ingredient (for the placeholder ingredient)

**Macro-less ingredient**:
An ingredient with no macro values at all; it counts as zero in recipe totals and marks shopping items incomplete.
_Avoid_: missing macros (for the ingredient), empty ingredient

### Import

**Import**:
Creating a recipe from a web page URL. The page is fetched and cleaned, the recipe is extracted, and the user reviews it before saving. UI: „Import z URL".
_Avoid_: scrape, crawl, parse (for the whole flow)

**Cleaning**:
The deterministic step that reduces a fetched page to the text a model needs.
_Avoid_: scraping, sanitizing

**Extraction**:
The language-model step that turns cleaned page text into a structured recipe draft.
_Avoid_: parsing, scraping, import (for the model step alone)

**Parsing**:
Any deterministic step that turns text into structure, such as yield text into base servings or an ingredient line into amount, unit and name.
_Avoid_: extraction (that is the model step)

**Review**:
The user step after extraction, where the draft is corrected, ingredients are auto-matched, and the recipe is saved. Nothing is saved without it. UI: „Auto-mapuj składniki" is the matching action within review.
_Avoid_: approval, confirmation, preview

**Auto-match**:
Linking each imported ingredient line to an existing ingredient, or to a new one from Open Food Facts or a placeholder.
_Avoid_: mapping, auto-map, matching (in prose)

**Open Food Facts**:
The public food database used as a source of ingredients and macros during auto-match and manual lookup.
_Avoid_: OFF (in prose), OpenFoodFacts

**LLM mode**:
Where extraction runs for the deployment: in the user's **browser**, or on the **server**. The two modes never fall back to each other.
_Avoid_: engine, runtime, backend, provider

### Plan and shopping

**Plan**:
One household's week of meals, starting on a Monday. Its slots are filled with recipes.
_Avoid_: week plan (wiki page title only), meal plan, schedule, week (for the object; "week" is fine for the date range)

**Week start**:
The Monday that a plan starts on. Plans can only start on Mondays.
_Avoid_: week number, week day

**Slot**:
One meal position on one day of a plan. It may hold a recipe with a servings count, or be empty. UI on the desktop: śniadanie, lunch, obiad, przekąska, kolacja; on mobile: „posiłek N" when unlabelled.
_Avoid_: meal, entry, cell, posiłek (UI label only)

**Unavailable recipe**:
A slot's recipe that the viewer cannot read, typically because access hides it, so its name cannot be shown. Deleting a recipe does not cause this; it empties the slot. UI: „przepis niedostępny".
_Avoid_: orphaned slot, deleted recipe (for the unavailable state), broken slot

**Shopping list**:
The aggregated ingredients needed for one plan's week, grouped by category.
_Avoid_: shopping cart, grocery list, shopping (in prose)

**Shopping item**:
One row of the shopping list: one ingredient in one unit, with its total amount and the original texts it came from.
_Avoid_: line, entry, product

**Unit separation**:
The same ingredient in two different units produces two shopping items. Amounts are never converted or summed across units.
_Avoid_: unit conversion (there is none), merging

**Incomplete shopping item**:
A shopping item where at least one contributing ingredient has no macro data. UI: „(brak makro)".
_Avoid_: partial, missing macros (for the item)

**Have mark**:
The per-device tick that says the user already has a shopping item for this week. It is never shared with the household or the server. UI: „mam to".
_Avoid_: have-it, have-map (the stored collection), pantry, stock, checkbox

