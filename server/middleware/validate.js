import { z } from 'zod';

/** Replaces `req.body` with the parsed, typed result, or returns a 400. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.join('.');
      return res.status(400).json({
        error: path ? `${path}: ${issue.message}` : issue?.message || 'Invalid request body.',
        code: 'invalid_body',
      });
    }
    req.body = result.data;
    return next();
  };
}

export const trimmed = (max) => z.string().trim().min(1).max(max);

export const trustedContactSchema = z.object({
  name: trimmed(255),
  phone: trimmed(50),
  relation: z.string().trim().max(100).optional().default('Trusted contact'),
});

export const registerSchema = z.object({
  name: trimmed(255),
  email: z.string().trim().toLowerCase().email().max(255),
  // 8 characters matches the "At least 8 characters" hint both clients show.
  password: z.string().min(8).max(200),
  phone: trimmed(50),
  address: trimmed(500),
  trustedContacts: z.array(trustedContactSchema).max(5).optional().default([]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
  method: z.enum(['email', 'google']).optional().default('email'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

export const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100000).optional().default(0),
  status: z.enum(['live', 'background', 'manual', 'demo']).optional().default('live'),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  avatarId: z.string().trim().max(32).optional(),
  role: z.string().trim().max(64).optional(),
  postsEnabled: z.boolean().optional(),
  feedsEnabled: z.boolean().optional(),
});

const MAX_INTERVAL_MINUTES = 48 * 60; // Matches the web app's 48h maximum.

export const settingsSchema = z.object({
  checkInIntervalMinutes: z.coerce.number().int().min(5).max(MAX_INTERVAL_MINUTES).optional(),
  remindEnabled: z.boolean().optional(),
  remindBeforeMinutes: z.coerce.number().int().min(0).max(120).optional(),
  notificationsEnabled: z.boolean().optional(),
  // Location tracking and the check-in timer are deliberately separate: pausing
  // check-ins should not silently disable location monitoring.
  trackingEnabled: z.boolean().optional(),
  monitoringEnabled: z.boolean().optional(),
});

export const checkInSchema = z.object({
  status: z.enum(['safe', 'missed']).optional().default('safe'),
  intervalMinutes: z.coerce.number().int().min(5).max(MAX_INTERVAL_MINUTES).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().trim().min(1).max(512),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  deviceName: z.string().trim().max(160).optional(),
});

export { MAX_INTERVAL_MINUTES };
