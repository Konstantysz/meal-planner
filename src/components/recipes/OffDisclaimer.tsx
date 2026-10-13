/** Shown wherever Open Food Facts values are shown or picked (issue #71). */
export const OFF_DISCLAIMER =
  'Dane z Open Food Facts — publicznej bazy tworzonej przez społeczność. Mogą zawierać błędy.';

export function OffDisclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-muted ${className}`.trim()}>{OFF_DISCLAIMER}</p>;
}
