import { z } from "zod";
import { SERVICE_CURRENCIES } from "@/lib/fx";
import { SLOT_LENGTHS, TIMEZONES, TONE_KEYS } from "@/lib/services";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "email");

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "email"),
  password: z.string().min(8).max(200),
  businessName: z.string().trim().min(2).max(80),
});

export const adminSubscriptionSchema = z.object({
  tenantId: z.string().trim().min(1).max(80),
  status: z.enum(["active", "trial", "suspended"]),
  plan: z.enum(["start", "business", "premium"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(120),
  password: z.string().min(1).max(200),
});

export const chatBodySchema = z.object({
  visitorKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  message: z.string().max(2000).optional().default(""),
  slotStartsAt: z.string().max(40).optional().nullable(),
  locale: z.enum(["ro", "en"]).optional(),
  contact: z
    .object({
      name: z.string().max(80).optional(),
      phone: z.string().max(40).optional(),
      email: z.string().max(120).optional(),
      service: z.string().max(80).optional(),
    })
    .optional(),
});

export const agentFormSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  description: z.string().max(2000),
  greeting: z.string().max(300),
  tone: z.enum(TONE_KEYS),
  customInstructions: z.string().max(4000),
  slotMinutes: z.coerce.number().refine((value) => (SLOT_LENGTHS as readonly number[]).includes(value)),
  timezone: z.enum(TIMEZONES),
  enabled: z.boolean(),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        durationMin: z.number().int().min(1).max(24 * 60).nullable(),
        price: z.number().min(0).max(1_000_000).nullable(),
        currency: z.enum(SERVICE_CURRENCIES),
        note: z.string().trim().max(160),
      }),
    )
    .max(30),
  openings: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        enabled: z.boolean(),
        startMin: z.number().int().min(0).max(24 * 60),
        endMin: z.number().int().min(0).max(24 * 60),
      }),
    )
    .length(7),
});

export const appointmentSchema = z.object({
  clientName: z.string().trim().min(2).max(80),
  clientPhone: z.string().trim().max(40).default(""),
  clientEmail: email.default(""),
  service: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(500).default(""),
  startsAt: z.string().min(10).max(40),
});

export const leadStatusSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(["new", "handled"]),
});

export function hasReachableContact(phone: string, email: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
