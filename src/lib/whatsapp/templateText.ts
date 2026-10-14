/** The approved body with {{1}}, {{2}}… filled in — what the thread
 * shows as the message we sent, and what the composer previews. Pure, so
 * client components can import it. */
export function renderTemplateBody(bodyText: string | null, variables: string[]): string {
  return (bodyText ?? "").replace(/\{\{(\d+)\}\}/g, (_, n: string) => variables[Number(n) - 1] ?? "");
}

/** How many distinct {{n}} placeholders a body has. */
export function countTemplateVariables(bodyText: string): number {
  return new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
}
