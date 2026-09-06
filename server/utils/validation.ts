import { z } from 'zod'

// Validate a request body with a shared zod schema; respond 422 with field errors.
export async function validateBody<S extends z.ZodType>(
  event: Parameters<typeof readBody>[0],
  schema: S,
): Promise<z.output<S>> {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: z.flattenError(result.error),
    })
  }
  return result.data
}

// Same contract as validateBody, for query params.
export function validateQuery<S extends z.ZodType>(
  event: Parameters<typeof getQuery>[0],
  schema: S,
): z.output<S> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: z.flattenError(result.error),
    })
  }
  return result.data
}

// Integer :id route param or 404 — a bad param must not reach the database.
export function parseIdParam(event: Parameters<typeof getRouterParam>[0]): number {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return id
}
