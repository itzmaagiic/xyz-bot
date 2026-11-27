/**
 * Plain-language text for a storage that does not persist (R-259, D-039) – with the next step for the user.
 * Lives in core because the bot keeps it in its view; the overlay and the Chrome options page show it.
 */
export function storageProblemText(p: unknown): string {
  if (p === 'volatile')
    return 'Einstellungen können nicht dauerhaft gespeichert werden (privates Surfen?). Sie gelten nur bis zum Neuladen.';
  const msg = p instanceof Error ? p.message || p.name : String(p);
  if (/Extension context invalidated/i.test(msg))
    return 'Die Verbindung zur Erweiterung ist abgerissen (z. B. nach einem Update). Bitte die Seite neu laden – bis dahin wird nichts gespeichert.';
  return `Einstellungen konnten nicht gespeichert werden: ${msg.replace(/\.$/, '')}. Sie gelten bis zum Neuladen.`;
}
