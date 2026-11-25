import { describe, expect, it } from 'vitest';
import { errorPause, isErrorPause } from '../../src/core/pause-reason';

describe('pause reasons (R-082, R-190)', () => {
  it.each(['action keeps failing: no effect after clicking #x', 'internal error: TypeError', 'blocked: reset'])(
    'error pause: %s',
    (r) => expect(isErrorPause(r)).toBe(true),
  );

  it.each([null, '', 'paused by user', 'run finished: champion', 'unknown screen: foo'])('wanted pause: %s', (r) =>
    expect(isErrorPause(r)).toBe(false),
  );

  it('recognises the reason as the overlay shows it (#pk-pause prefixes ⏸)', () => {
    expect(isErrorPause('⏸ action keeps failing: no effect after clicking #btn-auto-battle[0]')).toBe(true);
    expect(isErrorPause('⏸ paused by user')).toBe(false);
  });

  it('errorPause builds reasons that isErrorPause recognises', () => {
    expect(errorPause('failing', 'x')).toBe('action keeps failing: x');
    expect(errorPause('internal', 'y')).toBe('internal error: y');
    expect(errorPause('blocked', 'z')).toBe('blocked: z');
    for (const k of ['failing', 'internal', 'blocked'] as const) expect(isErrorPause(errorPause(k, 'd'))).toBe(true);
  });
});
