/** Bot version for the run logs (D-038). The build defines it from package.json; tests and dev builds get null. */
declare const __PKBOT_VERSION__: string | undefined;

export const BOT_VERSION: string | null = typeof __PKBOT_VERSION__ !== 'undefined' ? __PKBOT_VERSION__ : null;
