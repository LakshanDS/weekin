import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  email: z.email('Enter a valid email address').max(255),
  // Signup always creates a MEMBER account; MANAGER is granted by an admin.
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100),
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
})

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type RegisterInput = z.output<typeof registerSchema>
export type LoginInput = z.output<typeof loginSchema>
