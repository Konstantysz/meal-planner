export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Ładuję przepis…</span>
      <div aria-hidden="true" className="h-20 bg-hover lg:h-28" />
      <div aria-hidden="true" className="mx-auto max-w-5xl space-y-4 p-4 lg:px-8 lg:py-6">
        <div className="h-9 w-2/3 rounded-block bg-hover motion-safe:animate-pulse" />
        <div className="h-11 w-48 rounded-block bg-hover motion-safe:animate-pulse" />
        <div className="h-40 rounded-block bg-hover motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
