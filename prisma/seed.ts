import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}
import { PLAN_MONTHLY_PENCE } from "../src/lib/billing";
import { hashPassword } from "../src/lib/password";
import { serializeServices } from "../src/lib/services";
import { addZonedDays, startOfZonedDay, zonedParts, zonedWallTime, zonedWeekday } from "../src/lib/time";

const prisma = new PrismaClient();

function atNext(dayOfWeek: number, hour: number, minute: number, timeZone: string) {
  const today = startOfZonedDay(new Date(), timeZone);
  for (let offset = 1; offset <= 14; offset += 1) {
    const day = addZonedDays(today, offset, timeZone);
    if (zonedWeekday(day, timeZone) !== dayOfWeek) continue;
    const parts = zonedParts(day, timeZone);
    return zonedWallTime(parts.year, parts.month, parts.day, hour, minute, timeZone);
  }
  throw new Error("No upcoming day");
}

function atPast(dayOfWeek: number, hour: number, minute: number, timeZone: string) {
  const today = startOfZonedDay(new Date(), timeZone);
  for (let offset = 1; offset <= 14; offset += 1) {
    const day = addZonedDays(today, -offset, timeZone);
    if (zonedWeekday(day, timeZone) !== dayOfWeek) continue;
    const parts = zonedParts(day, timeZone);
    return zonedWallTime(parts.year, parts.month, parts.day, hour, minute, timeZone);
  }
  throw new Error("No past day");
}

function monthWindow(monthsAgo: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1, 8, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1, 8, 0, 0));
  const billedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 3, 8, 0, 0));
  return { start, end, billedAt };
}

async function main() {
  await prisma.user.deleteMany({ where: { email: "admin@redline.ro" } });
  await prisma.tenant.deleteMany({
    where: { slug: { in: ["salon-iris", "service-auto-radu", "clinica-dentara-exemplu"] } },
  });

  const irisPassword = await hashPassword("DemoIris2026!");
  const raduPassword = await hashPassword("DemoRadu2026!");
  const clinicaPassword = await hashPassword("DemoClinica2026!");
  const adminPassword = await hashPassword("AdminRedline2026!");

  const iris = await prisma.tenant.create({
    data: {
      name: "Salon Iris",
      slug: "salon-iris",
      publicKey: "pk_demo_saloniris",
      subscriptionPlan: "business",
      subscriptionStatus: "active",
      monthlyPricePence: PLAN_MONTHLY_PENCE.business,
      currency: "GBP",
      users: {
        create: {
          email: "iris@salon-iris.ro",
          name: "Ioana Ionescu",
          passwordHash: irisPassword,
          role: "owner",
        },
      },
      agent: {
        create: {
          businessName: "Salon Iris",
          description: "Salon de înfrumusețare în Cluj. Tuns, vopsit, coafat și manichiură, cu programare.",
          servicesJson: serializeServices([
            { name: "Tuns femei", detail: "", durationMin: 45, price: 120, currency: "RON", note: "" },
            { name: "Vopsit", detail: "", durationMin: 90, price: 250, currency: "RON", note: "de la" },
            { name: "Coafat ocazie", detail: "", durationMin: 60, price: 180, currency: "RON", note: "" },
            { name: "Manichiură", detail: "", durationMin: 45, price: 80, currency: "RON", note: "" },
          ]),
          tone: "prietenos",
          customInstructions: "Întreabă dacă vopsitul este pentru prima dată. Nu promite reduceri.",
          greeting: "Bună! Sunt recepția Salon Iris. Cu ce vă pot ajuta?",
          enabled: true,
          slotMinutes: 30,
          timezone: "Europe/Bucharest",
        },
      },
    },
  });

  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const open = day >= 2 && day <= 6;
    await prisma.availabilityRule.create({
      data: { tenantId: iris.id, dayOfWeek: day, startMin: 10 * 60, endMin: 19 * 60, enabled: open },
    });
  }

  const maria = await prisma.visitor.create({
    data: {
      tenantId: iris.id,
      anonKey: `seed-${randomBytes(4).toString("hex")}`,
      name: "Maria Stan",
      phone: "0744111222",
      source: "web_widget",
    },
  });
  const andrei = await prisma.visitor.create({
    data: {
      tenantId: iris.id,
      anonKey: `seed-${randomBytes(4).toString("hex")}`,
      name: "Andrei Pop",
      email: "andrei.pop@email.com",
      source: "web_widget",
    },
  });

  await prisma.lead.createMany({
    data: [
      {
        tenantId: iris.id,
        visitorId: maria.id,
        name: "Maria Stan",
        phone: "0744111222",
        note: "Vrea vopsit săptămâna aceasta.",
        status: "new",
        source: "web_widget",
      },
      {
        tenantId: iris.id,
        visitorId: andrei.id,
        name: "Andrei Pop",
        email: "andrei.pop@email.com",
        note: "A întrebat de tuns.",
        status: "handled",
        source: "web_widget",
      },
      {
        tenantId: iris.id,
        name: "Elena Nistor",
        phone: "0733555019",
        note: "Manichiură.",
        status: "new",
        source: "web_widget",
      },
    ],
  });

  const mariaTalk = await prisma.conversation.create({
    data: { tenantId: iris.id, visitorId: maria.id, channel: "web_widget", lastMessageAt: new Date() },
  });
  await prisma.message.createMany({
    data: [
      { tenantId: iris.id, conversationId: mariaTalk.id, role: "visitor", content: "Bună, aș vrea un vopsit săptămâna aceasta." },
      { tenantId: iris.id, conversationId: mariaTalk.id, role: "assistant", content: "Cu drag. Ca să rezerv, am nevoie de nume și de un telefon." },
      { tenantId: iris.id, conversationId: mariaTalk.id, role: "visitor", content: "Mă numesc Maria Stan, telefon 0744111222." },
      { tenantId: iris.id, conversationId: mariaTalk.id, role: "assistant", content: "Am notat. Alegeți un interval liber." },
    ],
  });

  const tz = "Europe/Bucharest";
  const mariaStart = atNext(2, 11, 0, tz);
  await prisma.appointment.create({
    data: {
      tenantId: iris.id,
      visitorId: maria.id,
      clientName: "Maria Stan",
      clientPhone: "0744111222",
      service: "Tuns femei",
      startsAt: mariaStart,
      endsAt: new Date(mariaStart.getTime() + 30 * 60_000),
      status: "booked",
      source: "web_widget",
    },
  });
  const elenaStart = atNext(4, 15, 30, tz);
  await prisma.appointment.create({
    data: {
      tenantId: iris.id,
      clientName: "Elena Nistor",
      clientPhone: "0733555019",
      service: "Manichiură",
      startsAt: elenaStart,
      endsAt: new Date(elenaStart.getTime() + 30 * 60_000),
      status: "booked",
      source: "dashboard",
    },
  });
  const doneStart = atPast(2, 12, 0, tz);
  await prisma.appointment.create({
    data: {
      tenantId: iris.id,
      clientName: "Andrei Pop",
      clientEmail: "andrei.pop@email.com",
      service: "Tuns femei",
      startsAt: doneStart,
      endsAt: new Date(doneStart.getTime() + 30 * 60_000),
      status: "completed",
      source: "dashboard",
    },
  });

  const radu = await prisma.tenant.create({
    data: {
      name: "Service Auto Radu",
      slug: "service-auto-radu",
      publicKey: "pk_demo_serviceradu",
      subscriptionPlan: "start",
      subscriptionStatus: "trial",
      monthlyPricePence: PLAN_MONTHLY_PENCE.start,
      currency: "GBP",
      users: {
        create: {
          email: "radu@service-radu.ro",
          name: "Radu Marinescu",
          passwordHash: raduPassword,
          role: "owner",
        },
      },
      agent: {
        create: {
          businessName: "Service Auto Radu",
          description: "Service auto în Brașov. Revizii, frâne și diagnoză.",
          servicesJson: serializeServices([
            { name: "Revizie", detail: "", durationMin: 60, price: null, currency: "RON", note: "" },
            { name: "Diagnoză", detail: "", durationMin: 45, price: null, currency: "RON", note: "" },
          ]),
          greeting: "Bună! Sunt recepția Service Auto Radu. Cu ce vă putem ajuta?",
          enabled: true,
          slotMinutes: 45,
          timezone: "Europe/Bucharest",
        },
      },
    },
  });
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.availabilityRule.create({
      data: {
        tenantId: radu.id,
        dayOfWeek: day,
        startMin: 8 * 60,
        endMin: 16 * 60 + 30,
        enabled: day >= 1 && day <= 5,
      },
    });
  }
  await prisma.lead.create({
    data: {
      tenantId: radu.id,
      name: "Cristian Dima",
      phone: "0722111999",
      note: "Schimb de ulei.",
      status: "new",
      source: "web_widget",
    },
  });
  const raduStart = atNext(1, 9, 0, tz);
  await prisma.appointment.create({
    data: {
      tenantId: radu.id,
      clientName: "Cristian Dima",
      clientPhone: "0722111999",
      service: "Revizie",
      startsAt: raduStart,
      endsAt: new Date(raduStart.getTime() + 45 * 60_000),
      status: "booked",
      source: "web_widget",
    },
  });

  const clinica = await prisma.tenant.create({
    data: {
      name: "Clinica Dentară Exemplu",
      slug: "clinica-dentara-exemplu",
      publicKey: "pk_demo_clinicadentara",
      subscriptionPlan: "premium",
      subscriptionStatus: "active",
      monthlyPricePence: PLAN_MONTHLY_PENCE.premium,
      currency: "GBP",
      users: {
        create: {
          email: "clinica@dentară-exemplu.ro",
          name: "Dr. Elena Popescu",
          passwordHash: clinicaPassword,
          role: "owner",
        },
      },
      agent: {
        create: {
          businessName: "Clinica Dentară Exemplu",
          description:
            "Clinică stomatologică în București. Consultații, igienizare, obturații și implantologie, cu programare.",
          servicesJson: serializeServices([
            { name: "Consultație", detail: "", durationMin: 30, price: 150, currency: "RON", note: "" },
            { name: "Igienizare", detail: "", durationMin: 45, price: 250, currency: "RON", note: "" },
            { name: "Obturație", detail: "", durationMin: 60, price: 300, currency: "RON", note: "de la" },
            { name: "Implant consult", detail: "", durationMin: 45, price: 200, currency: "RON", note: "" },
          ]),
          tone: "profesional",
          customInstructions: "Nu oferi diagnostice definitive pe chat. Propune consultație la clinică.",
          greeting: "Bună! Sunt recepția Clinicii Dentare Exemplu. Cu ce vă pot ajuta?",
          enabled: true,
          slotMinutes: 30,
          timezone: "Europe/Bucharest",
        },
      },
    },
  });

  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.availabilityRule.create({
      data: {
        tenantId: clinica.id,
        dayOfWeek: day,
        startMin: 9 * 60,
        endMin: 18 * 60,
        enabled: day >= 1 && day <= 5,
      },
    });
  }

  await prisma.lead.create({
    data: {
      tenantId: clinica.id,
      name: "Ioana Vasilescu",
      phone: "0733123456",
      note: "Vrea igienizare săptămâna aceasta.",
      status: "new",
      source: "web_widget",
    },
  });

  const clinicaStart = atNext(2, 10, 0, tz);
  await prisma.appointment.create({
    data: {
      tenantId: clinica.id,
      clientName: "Ioana Vasilescu",
      clientPhone: "0733123456",
      service: "Igienizare",
      startsAt: clinicaStart,
      endsAt: new Date(clinicaStart.getTime() + 45 * 60_000),
      status: "booked",
      source: "web_widget",
    },
  });

  const irisCurrent = monthWindow(0);
  const irisPrevious = monthWindow(1);
  const irisOlder = monthWindow(2);
  const raduCurrent = monthWindow(0);
  const raduPrevious = monthWindow(1);
  const clinicaCurrent = monthWindow(0);
  const clinicaPrevious = monthWindow(1);
  await prisma.subscriptionPayment.createMany({
    data: [
      {
        tenantId: iris.id,
        plan: "business",
        amountPence: PLAN_MONTHLY_PENCE.business,
        currency: "GBP",
        status: "succeeded",
        periodStart: irisOlder.start,
        periodEnd: irisOlder.end,
        invoiceRef: "INV-IRIS-001",
        createdAt: irisOlder.billedAt,
      },
      {
        tenantId: iris.id,
        plan: "business",
        amountPence: PLAN_MONTHLY_PENCE.business,
        currency: "GBP",
        status: "succeeded",
        periodStart: irisPrevious.start,
        periodEnd: irisPrevious.end,
        invoiceRef: "INV-IRIS-002",
        createdAt: irisPrevious.billedAt,
      },
      {
        tenantId: iris.id,
        plan: "business",
        amountPence: PLAN_MONTHLY_PENCE.business,
        currency: "GBP",
        status: "succeeded",
        periodStart: irisCurrent.start,
        periodEnd: irisCurrent.end,
        invoiceRef: "INV-IRIS-003",
        createdAt: irisCurrent.billedAt,
      },
      {
        tenantId: radu.id,
        plan: "start",
        amountPence: PLAN_MONTHLY_PENCE.start,
        currency: "GBP",
        status: "failed",
        periodStart: raduPrevious.start,
        periodEnd: raduPrevious.end,
        invoiceRef: "INV-RADU-001",
        createdAt: raduPrevious.billedAt,
      },
      {
        tenantId: radu.id,
        plan: "start",
        amountPence: PLAN_MONTHLY_PENCE.start,
        currency: "GBP",
        status: "due",
        periodStart: raduCurrent.start,
        periodEnd: raduCurrent.end,
        invoiceRef: "INV-RADU-002",
        createdAt: raduCurrent.billedAt,
      },
      {
        tenantId: clinica.id,
        plan: "premium",
        amountPence: PLAN_MONTHLY_PENCE.premium,
        currency: "GBP",
        status: "succeeded",
        periodStart: clinicaPrevious.start,
        periodEnd: clinicaPrevious.end,
        invoiceRef: "INV-CLINICA-001",
        createdAt: clinicaPrevious.billedAt,
      },
      {
        tenantId: clinica.id,
        plan: "premium",
        amountPence: PLAN_MONTHLY_PENCE.premium,
        currency: "GBP",
        status: "succeeded",
        periodStart: clinicaCurrent.start,
        periodEnd: clinicaCurrent.end,
        invoiceRef: "INV-CLINICA-002",
        createdAt: clinicaCurrent.billedAt,
      },
    ],
  });

  await prisma.user.create({
    data: {
      email: "admin@redline.ro",
      name: "RedLine Admin",
      passwordHash: adminPassword,
      role: "admin",
    },
  });

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_no_double_book" ON "Appointment"("tenantId", "startsAt") WHERE "status" != 'cancelled'`,
  );
  console.log(
    "Seed gata. Salon Iris, Service Auto Radu, Clinica Dentară Exemplu și admin@redline.ro.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
