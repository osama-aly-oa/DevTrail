import type { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../database.ts';
import { HttpError } from '../middleware/error-handler.ts';
import { rejectBody } from '../middleware/security.ts';
import { emptyObject, id, idPath, parse, requiredText } from '../validation.ts';
import { domainOperation } from './repositories.ts';
import type { DomainMiddleware } from './growth.ts';

const maxSize = 160 * 1024;
const maxFiles = 5;
const signatures = {
  'application/pdf': Buffer.from('%PDF-'),
  'image/png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  'image/jpeg': Buffer.from([255, 216, 255]),
};
const filePayload = z.strictObject({
  name: requiredText(120).refine(value => !/[\\/\p{C}]/u.test(value) && value !== '.' && value !== '..'),
  mediaType: z.enum(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf', 'image/png', 'image/jpeg']),
  content: z.string().min(4).max(Math.ceil(maxSize / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
const attachmentPath = z.strictObject({ id, attachmentId: id });
const metadata = { id: true, name: true, mediaType: true, size: true, createdAt: true } as const;

function attachmentDto<T extends { id: bigint }>(file: T) {
  return { ...file, id: file.id.toString() };
}

function decodeFile({ content, mediaType }: z.infer<typeof filePayload>) {
  const file = Buffer.from(content, 'base64');
  if (file.length > maxSize || file.toString('base64') !== content) {
    throw new HttpError(400, 'INVALID_ATTACHMENT', 'Supply a base64 file of at most 160 KiB.');
  }

  if (mediaType in signatures) {
    const signature = signatures[mediaType as keyof typeof signatures];
    if (file.subarray(0, signature.length).equals(signature)) return file;
    throw new HttpError(400, 'INVALID_ATTACHMENT', 'File content does not match the declared media type.');
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(file);
    if (text.includes('\u0000')) throw new Error();
    if (mediaType === 'application/json') JSON.parse(text);
    return file;
  } catch {
    throw new HttpError(400, 'INVALID_ATTACHMENT', 'Text attachments must contain valid UTF-8 for the declared media type.');
  }
}

export function mountAttachments(router: Router, prisma: Database['prisma'], { read, write, writeJson }: DomainMiddleware) {
  const path = '/sessions/:id/attachments';
  router.get(path, ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const session = await domainOperation(() => prisma.developmentSession.findUniqueOrThrow({
      where: { id }, select: { attachments: { select: metadata, orderBy: { id: 'asc' } } },
    }), 'session', 'read');
    response.json({ data: session.attachments.map(attachmentDto) });
  });

  router.post(path, ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const payload = parse(filePayload, request.body, 'body');
    const content = decodeFile(payload);
    const file = await domainOperation(() => prisma.$transaction(async transaction => {
      // Updating the parent acquires its row lock before checking the upload quota.
      await transaction.developmentSession.update({ where: { id }, data: { updatedAt: new Date() } });
      if (await transaction.sessionAttachment.count({ where: { sessionId: id } }) >= maxFiles) {
        throw new HttpError(409, 'ATTACHMENT_LIMIT', 'A session can hold up to five attachments.');
      }
      return transaction.sessionAttachment.create({
        data: { sessionId: id, name: payload.name, mediaType: payload.mediaType, content, size: content.length },
        select: metadata,
      });
    }), 'session', 'write');
    response.status(201).location('/api/v1/sessions/' + id + '/attachments/' + file.id).json({ data: attachmentDto(file) });
  });

  router.get(path + '/:attachmentId', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id, attachmentId } = parse(attachmentPath, request.params, 'path');
    const file = await domainOperation(() => prisma.sessionAttachment.findUniqueOrThrow({
      where: { id: attachmentId, sessionId: id },
    }), 'attachment', 'read');
    response.attachment(file.name)
      .set('Content-Type', file.mediaType)
      .set('X-Content-Type-Options', 'nosniff')
      .set('Content-Security-Policy', 'sandbox')
      .send(Buffer.from(file.content));
  });

  router.delete(path + '/:attachmentId', ...write, rejectBody, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id, attachmentId } = parse(attachmentPath, request.params, 'path');
    await domainOperation(() => prisma.sessionAttachment.delete({
      where: { id: attachmentId, sessionId: id }, select: { id: true },
    }), 'attachment', 'delete');
    response.status(204).end();
  });
}
