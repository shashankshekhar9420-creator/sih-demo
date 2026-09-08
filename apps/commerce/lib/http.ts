import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/client';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function endpoint<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Please check the submitted fields and try again.', code: 'VALIDATION_ERROR' }, { status: 400 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P1008', 'P2028'].includes(error.code)) {
        return NextResponse.json({ error: 'This record changed or is busy. Please refresh and retry.', code: 'CONFLICT' }, { status: 409 });
      }
      console.error('[commerce API]', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : 'UnknownError');
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
  };
}

export const idSchema = z.string().trim().min(1).max(200);
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 100_000) throw new ApiError(400, 'VALIDATION_ERROR', 'Request is too large.');
  return JSON.parse(text);
}
