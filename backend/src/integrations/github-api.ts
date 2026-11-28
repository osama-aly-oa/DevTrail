import { z } from 'zod';
import { HttpError } from '../middleware/error-handler.ts';

export const repositoryOwner = z.string().trim().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
export const repositoryName = z.string().trim().regex(/^[A-Za-z0-9_.-]{1,100}$/)
  .refine(value => value !== '.' && value !== '..');

const info = z.object({
  name: repositoryName,
  owner: z.object({ login: repositoryOwner }),
  default_branch: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
});

const person = z.object({ login: z.string() }).nullish();
const githubTimestamp = z.iso.datetime({ offset: true }).transform(value => new Date(value));
const commits = z.array(z.object({
  sha: z.string().regex(/^[a-f0-9]{40,64}$/i),
  commit: z.object({ message: z.string(), committer: z.object({ date: githubTimestamp }) }),
  author: person,
})).max(30);
const pulls = z.array(z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullish(),
  user: person,
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional(),
  created_at: githubTimestamp,
  merged_at: githubTimestamp.nullish(),
})).max(30);

type Coordinates = { owner: string; name: string };
export type RepositoryMetadata = Coordinates & { defaultBranch: string; description: string | null; isPrivate: boolean };
export type ImportedActivity = {
  kind: 'commit' | 'pull_request'; externalId: string; title: string; url: string;
  author: string | null; occurredAt: Date; details: string | null;
};

export type GithubClient = ReturnType<typeof createGithubClient>;

export class GithubRateLimitError extends HttpError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(429, 'GITHUB_RATE_LIMITED', 'GitHub temporarily limited requests. Wait before refreshing.');
    this.retryAfter = retryAfter;
  }
}

export function repositoryUrl({ owner, name }: Coordinates) {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function gitPath({ owner, name }: Coordinates) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function cleanText(value: string, length: number) {
  return Array.from(value.replace(/[\u0000\p{Surrogate}]/gu, '').trim()).slice(0, length).join('');
}

function upstreamData<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(502, 'GITHUB_INVALID_DATA', 'GitHub returned unexpected repository data.');
  return result.data;
}

export function createGithubClient(token: string | undefined, fetcher = fetch) {
  let rateLimitedUntil = 0;

  async function get(path: string, signal: AbortSignal, emptyRepository = false) {
    const now = Date.now();
    if (rateLimitedUntil > now) throw new GithubRateLimitError(Math.ceil((rateLimitedUntil - now) / 1_000));
    let response: Response;
    let body: unknown;
    try {
      response = await fetcher(new URL(path, 'https://api.github.com'), {
        signal, redirect: 'error',
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': 'DevTrail/2', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (response.ok || response.status === 403 || (emptyRepository && response.status === 409)) {
        body = await response.json().catch((error: unknown) => {
          if (response.ok || signal.aborted) throw error;
          return undefined;
        }) as unknown;
      } else {
        void response.body?.cancel().catch(() => {});
      }
    } catch {
      if (signal.aborted) throw new HttpError(504, 'GITHUB_TIMEOUT', 'The GitHub request timed out. Try again.');
      throw new HttpError(502, 'GITHUB_UNAVAILABLE', 'DevTrail could not reach GitHub. Try again later.');
    }

    const errorBody = z.object({ message: z.string().optional() }).safeParse(body);
    const message = errorBody.success ? errorBody.data.message ?? '' : '';
    const exhausted = response.headers.get('X-RateLimit-Remaining') === '0';
    const suppliedDelay = Number(response.headers.get('Retry-After'));
    if (response.status === 429 || (response.status === 403 && (exhausted || suppliedDelay || /rate limit/i.test(message)))) {
      const reset = Number(response.headers.get('X-RateLimit-Reset')) * 1_000;
      const delay = suppliedDelay || (exhausted && reset > Date.now() ? Math.ceil((reset - Date.now()) / 1_000) : 60);
      rateLimitedUntil = Date.now() + Math.min(Math.max(1, delay), 86_400) * 1_000;
      throw new GithubRateLimitError(Math.ceil((rateLimitedUntil - Date.now()) / 1_000));
    }
    if (response.status === 409 && emptyRepository && /^Git Repository is empty\.?$/i.test(message)) {
      return { body: [], hasNext: false };
    }
    if (response.status === 404) {
      throw new HttpError(404, 'GITHUB_REPOSITORY_UNAVAILABLE', 'GitHub could not find the repository or the server lacks access to it.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, 'GITHUB_ACCESS_DENIED', 'GitHub denied access. Check the server token and repository permissions.');
    }
    if (!response.ok) throw new HttpError(502, 'GITHUB_REQUEST_FAILED', 'GitHub could not complete the request.');
    return { body, hasNext: /<[^>]+>;\s*rel="next"/i.test(response.headers.get('Link') ?? '') };
  }

  async function metadata(coordinates: Coordinates, signal: AbortSignal): Promise<RepositoryMetadata> {
    const { body } = await get(gitPath(coordinates), signal);
    const repo = upstreamData(info, body);
    return { owner: repo.owner.login, name: repo.name, defaultBranch: cleanText(repo.default_branch, 255),
      description: repo.description && cleanText(repo.description, 1_000), isPrivate: repo.private };
  }

  async function recent<T>(path: string, schema: z.ZodType<T[]>, signal: AbortSignal, emptyRepository = false) {
    const data: T[] = [];
    let hasNext = true;
    for (let page = 1; hasNext && page <= 3; page++) {
      const result = await get(`${path}&per_page=30&page=${page}`, signal, emptyRepository);
      data.push(...upstreamData(schema, result.body));
      hasNext = result.hasNext;
    }
    return { data, hasNext };
  }

  async function activity(repository: RepositoryMetadata, signal: AbortSignal) {
    const path = gitPath(repository);
    const baseUrl = repositoryUrl(repository);
    const foundCommits = await recent(`${path}/commits?sha=${encodeURIComponent(repository.defaultBranch)}`, commits, signal, true);
    const foundPulls = await recent(`${path}/pulls?state=all&sort=updated&direction=desc`, pulls, signal);

    const commitActivity = foundCommits.data.map((item): ImportedActivity => {
      const [title, ...details] = item.commit.message.split(/\r?\n/);
      return { kind: 'commit', externalId: item.sha, title: cleanText(title, 240) || item.sha.slice(0, 7),
        url: `${baseUrl}/commit/${item.sha}`, author: item.author ? cleanText(item.author.login, 100) : null,
        occurredAt: item.commit.committer.date, details: cleanText(details.join('\n'), 2_000) || null };
    });
    const pullActivity = foundPulls.data.map((item): ImportedActivity => {
      const state = item.merged_at ? 'Merged' : item.draft && item.state === 'open' ? 'Draft' : item.state === 'open' ? 'Open' : 'Closed';
      return { kind: 'pull_request', externalId: String(item.number),
        title: cleanText(item.title, 240) || `Pull request #${item.number}`, url: `${baseUrl}/pull/${item.number}`,
        author: item.user ? cleanText(item.user.login, 100) : null, occurredAt: item.created_at,
        details: cleanText(item.body ? `${state}\n${item.body}` : state, 2_000) };
    });
    const unique = new Map([...commitActivity, ...pullActivity].map(item => [`${item.kind}:${item.externalId}`, item]));
    return { activity: [...unique.values()], truncated: foundCommits.hasNext || foundPulls.hasNext };
  }

  return { metadata, activity };
}
