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
