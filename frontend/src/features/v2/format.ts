export function splitList(value: string, kind: 'labels' | 'links' = 'labels') {
  const entries = new Map<string, string>();
  for (const valuePart of value.split(kind === 'links' ? /\n/ : /[,\n]/)) {
    const entry = valuePart.trim();
    const key = kind === 'links' ? entry : entry.normalize('NFC').toLowerCase();
    if (entry && !entries.has(key)) entries.set(key, entry);
  }
  return [...entries.values()];
}

export function externalUrl(value: string) {
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : 'DevTrail could not complete the request. Try again.';
}
