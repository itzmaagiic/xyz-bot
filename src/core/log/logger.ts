/** Ring-buffer logger shared by core and UI. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'decision';

export interface LogEntry {
  t: number;
  level: LogLevel;
  msg: string;
  data?: unknown;
}

export class Logger {
  private buf: LogEntry[] = [];
  private subs = new Set<(e: LogEntry) => void>();

  constructor(private readonly max = 500) {}

  log(level: LogLevel, msg: string, data?: unknown): void {
    const e: LogEntry = { t: Date.now(), level, msg, data };
    this.buf.push(e);
    if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max);
    for (const s of this.subs) {
      try {
        s(e);
      } catch {
        /* subscriber errors must not break the bot */
      }
    }
  }

  info = (m: string, d?: unknown) => this.log('info', m, d);
  warn = (m: string, d?: unknown) => this.log('warn', m, d);
  error = (m: string, d?: unknown) => this.log('error', m, d);
  debug = (m: string, d?: unknown) => this.log('debug', m, d);

  entries(): readonly LogEntry[] {
    return this.buf;
  }

  subscribe(fn: (e: LogEntry) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  clear(): void {
    this.buf = [];
  }

  toText(): string {
    return this.buf
      .map((e) => {
        const d = e.data === undefined ? '' : ' ' + safeJson(e.data);
        return `${new Date(e.t).toISOString()} [${e.level}] ${e.msg}${d}`;
      })
      .join('\n');
  }
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
