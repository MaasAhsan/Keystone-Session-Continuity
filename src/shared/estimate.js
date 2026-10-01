/* Visible-text token estimate. Labeled as an estimate on purpose. */
(() => {
  const K = (globalThis.Keystone = globalThis.Keystone || {});

  K.estimateTokens = function estimateTokens(text) {
    const chars = String(text || '').length;
    return Math.max(0, Math.ceil(chars / 4));
  };

  K.estimateThread = function estimateThread(messages, windowTokens) {
    const joined = (messages || []).map((m) => m.text || '').join('\n');
    const tokens = K.estimateTokens(joined);
    const window = windowTokens || 128000;
    const ratio = window ? tokens / window : 0;
    return {
      tokens,
      window,
      ratio,
      percent: Math.max(0, Math.min(999, Math.round(ratio * 100))),
    };
  };
})();
