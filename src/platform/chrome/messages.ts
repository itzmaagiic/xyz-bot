/** Messages between popup/background and the content script. */
export type ContentRequest =
  | { type: 'pkbot:status' }
  | { type: 'pkbot:toggle' }
  | { type: 'pkbot:start' }
  | { type: 'pkbot:pause' }
  | { type: 'pkbot:step' }
  | { type: 'pkbot:overlay' };

export interface StatusReply {
  status: string;
  pauseReason: string | null;
  screen: string;
  lastDecision: string;
  bridge: boolean;
  version: string | null;
  runs: number;
  wins: number;
  losses: number;
}

export type BackgroundRequest = { type: 'pkbot:notify'; title: string; body: string };

export const COMMAND_TO_MESSAGE: Record<string, ContentRequest['type']> = {
  'toggle-bot': 'pkbot:toggle',
  'step-bot': 'pkbot:step',
  'toggle-overlay': 'pkbot:overlay',
};
