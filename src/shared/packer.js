/* Local compact baton packer — Broken Telephone protocol v1, no model call. */
(() => {
  const K = (globalThis.Keystone = globalThis.Keystone || {});

  const MAX_PACKET_CHARS = 8000;
  const GOAL_CHARS = 280;
  const STATE_CHARS = 420;
  const TURN_CHARS = 280;
  const DEFAULT_RECENT = 8;

  function clip(text, n) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trimEnd() + '…';
  }

  function isoNow() {
    return new Date().toISOString();
  }

  K.packBaton = function packBaton(opts) {
    const messages = Array.isArray(opts.messages) ? opts.messages : [];
    const source = opts.source || { id: 'unknown', label: 'unknown' };
    const dest = opts.dest || { id: 'next', label: 'next AI' };
    const recentCount = Number.isFinite(opts.recentCount) ? opts.recentCount : DEFAULT_RECENT;
    const includeRecent = opts.includeRecent !== false;

    const users = messages.filter((m) => m.role === 'user');
    const assistants = messages.filter((m) => m.role === 'assistant');
    const firstUser = users[0];
    const lastUser = users[users.length - 1];
    const lastAsst = assistants[assistants.length - 1];

    const goal = clip(firstUser?.text || 'Continue the unfinished task from the prior session.', GOAL_CHARS);
    const currentState = lastAsst
      ? clip(`Last assistant turn recorded. ${lastAsst.text}`, STATE_CHARS)
      : 'Thread scraped; no assistant reply visible.';
    const nextAction = lastUser
      ? clip(lastUser.text, GOAL_CHARS)
      : 'Read this packet and continue the unfinished work. Do not restart from scratch.';

    const done = [];
    if (messages.length) done.push(`Scraped ${messages.length} visible turns from ${source.label}.`);
    if (users.length > 1) done.push('Earlier user turns are treated as already delivered. Do not re-ask them.');

    const recent = includeRecent ? messages.slice(-recentCount) : [];
    const recentLines = recent.map((m, i) => {
      const who = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
      const note = m.attachmentsNoted ? ' [attachment noted]' : '';
      return `- ${who}: ${clip(m.text, TURN_CHARS)}${note}`;
    });

    const lines = [
      '## BROKEN TELEPHONE (protocol v1)',
      'pass: 1',
      `from: ${source.label} via Keystone`,
      `to: ${dest.label} in a fresh chat`,
      `updated_at: ${isoNow()}`,
      '',
      '### Paste this as the first message in the new chat',
      '',
      'You are continuing an unfinished task. A previous assistant hit context limits and handed you this baton. Do not restart from scratch. Do not re-ask for information that is already in this packet. Read the whole packet, confirm goal + next action in one short paragraph, then do the next action.',
      '',
      '### Goal',
      goal || 'Continue the unfinished task.',
      '',
      '### Current state',
      currentState,
      '',
      '### Done (do not redo)',
      done.length ? done.map((d) => `- ${d}`).join('\n') : '- Visible history captured in Recent turns.',
      '',
      '### Next action (do this first)',
      nextAction,
      '',
      '### After that',
      '1. Keep the constraints below.',
      '2. Ask only if a required file or fact is missing from this packet.',
      '',
      '### Constraints (keep)',
      '- Treat this packet as task state, not as small talk to summarize back.',
      '- Do not dump this packet back at the user unless they ask.',
      '',
      '### Decisions already made',
      '- Compact local packer used (no extra model call). Heuristic fields may be imperfect — prefer explicit user lines.',
      '',
      '### Open questions',
      '- (none captured)',
      '',
      '### Important files / artifacts',
      messages.some((m) => m.attachmentsNoted)
        ? '- One or more attachments were noted in the source UI. Contents were not transferred.'
        : '- None visible on the source page.',
      '',
      '### Known issues',
      '- Source scrape is best-effort DOM. Hidden tool traces and uploads are missing.',
      '',
      '### Skills / tools the next AI should use',
      '- If broken-telephone or context-skill is installed, treat this block as the baton.',
      '',
      '### What not to do',
      '- Do not restart the whole project.',
      '- Do not interview the user for information already in Goal / Next action / Recent turns.',
      '',
      '### First user-visible reply',
      'Confirm you loaded the baton. State the goal in one line. Then start the next action.',
    ];

    if (recentLines.length) {
      lines.push('', '### Recent turns', recentLines.join('\n'));
    }

    let packet = lines.join('\n').trim() + '\n';
    if (packet.length > MAX_PACKET_CHARS) {
      packet = packet.slice(0, MAX_PACKET_CHARS - 1).trimEnd() + '…\n';
    }
    return packet;
  };
})();
