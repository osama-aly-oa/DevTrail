import { describe, expect, it, vi } from 'vitest';
import { createGithubClient } from '../src/integrations/github-api.ts';

const coordinates = { owner: 'devtrail-fixture', name: 'training' };
const commit = {
  sha: 'f'.repeat(40), commit: { message: 'First line\n\nDetails', committer: { date: '2025-02-03T08:30:00Z' } }, author: null,
};
const pull = { number: 42, title: 'Fixture pull request', user: { login: 'contributor' }, state: 'closed',
  created_at: '2025-02-01T15:00:00Z', merged_at: '2025-02-02T15:00:00Z' };

describe('GitHub REST client', () => {
  it('paginates relative to the official API, deduplicates items and sends a read-only request', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ owner: { login: coordinates.owner }, name: coordinates.name, default_branch: 'main',
        description: null, private: true }))
      .mockResolvedValueOnce(Response.json([commit], { headers: { Link: '<https://example.invalid/path>; rel="next"' } }))
      .mockResolvedValueOnce(Response.json([commit]))
      .mockResolvedValueOnce(Response.json([pull]));
    const client = createGithubClient('fixture-token', fetcher);
    const signal = new AbortController().signal;
    const repository = await client.metadata(coordinates, signal);
    expect(repository).toMatchObject({ ...coordinates, defaultBranch: 'main', isPrivate: true });
    const result = await client.activity(repository, signal);
    expect(result.truncated).toBe(false);
    expect(result.activity).toMatchObject([
      { kind: 'commit', title: 'First line', externalId: commit.sha, details: 'Details', author: null, occurredAt: new Date('2025-02-03T08:30:00Z') },
      { kind: 'pull_request', externalId: '42', title: 'Fixture pull request', details: 'Merged', author: 'contributor' },
    ]);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.github.com/repos/devtrail-fixture/training',
      'https://api.github.com/repos/devtrail-fixture/training/commits?sha=main&per_page=30&page=1',
      'https://api.github.com/repos/devtrail-fixture/training/commits?sha=main&per_page=30&page=2',
      'https://api.github.com/repos/devtrail-fixture/training/pulls?state=all&sort=updated&direction=desc&per_page=30&page=1',
    ]);
    for (const [, options] of fetcher.mock.calls) {
      expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture-token');
      expect(options?.method).toBeUndefined();
      expect(options?.redirect).toBe('error');
    }
  });

  it('reports an upstream cooldown and avoids additional network calls during it', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403, headers: { 'Retry-After': '30' } }));
    const client = createGithubClient(undefined, fetcher);
    const signal = new AbortController().signal;
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(client.metadata(coordinates, signal)).rejects.toMatchObject({ code: 'GITHUB_RATE_LIMITED', retryAfter: 30 });
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBeNull();
  });
});
