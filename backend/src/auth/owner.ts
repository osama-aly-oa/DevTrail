import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Database } from '../database.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { password, username } from '../validation.ts';

const passwordHashOptions: argon2.HashOptions = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export class ProvisionError extends Error {}

export async function provisionOwner(prisma: Database['prisma'], env: NodeJS.ProcessEnv) {
  const suppliedUsername = username.safeParse(env.OWNER_USERNAME);
  const suppliedPassword = password.safeParse(env.OWNER_PASSWORD);
  if (!suppliedUsername.success || !suppliedPassword.success || Array.from(suppliedPassword.data).length < 12 ||
      !suppliedPassword.data.trim()) {
    throw new ProvisionError('Set a valid OWNER_USERNAME and an OWNER_PASSWORD with 12–256 characters.');
  }

  const current = await prisma.owner.findUnique({ where: { id: 1 }, select: { username: true } });
  if (!current) {
    const passwordHash = await argon2.hash(suppliedPassword.data, passwordHashOptions);
    try {
      await prisma.owner.create({ data: { username: suppliedUsername.data, passwordHash } });
      return 'Owner provisioned.';
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  const existing = current ?? await prisma.owner.findUniqueOrThrow({ where: { id: 1 }, select: { username: true } });
  if (existing.username !== suppliedUsername.data) {
    throw new ProvisionError('The configured username differs from the existing owner.');
  }
  return 'Existing owner retained. Password unchanged.';
}

export function createOwnerAuthenticator(prisma: Database['prisma']) {
  let dummyHash: Promise<string> | undefined;

  return async (input: { username: string; password: string }) => {
    const owner = await prisma.owner.findUnique({ where: { id: 1 }, select: { username: true, passwordHash: true } });
    const hash = owner?.passwordHash ?? await (dummyHash ??=
      argon2.hash(randomBytes(32), passwordHashOptions));
    const verified = await argon2.verify(hash, input.password);
    return verified && owner?.username === input.username ? { username: owner.username } : null;
  };
}
