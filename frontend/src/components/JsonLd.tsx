// Renders a schema.org JSON-LD block as a <script type="application/ld+json">.
//
// JSON-LD is DATA, not executable JavaScript — search engines parse it, browsers
// never run it — so it is exempt from CSP script execution rules even under a
// strict policy. (Our CSP also allows 'unsafe-inline' for scripts, so this is
// doubly safe.) We stringify on the server and inject via
// dangerouslySetInnerHTML, escaping "<" to avoid any chance of breaking out of
// the script element.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
