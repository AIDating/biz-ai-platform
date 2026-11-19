import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}
import { hashPassword } from "../src/lib/password";
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

async function main() {
  await prisma.tenant.deleteMany({ where: { slug: { in: ["salon-iris", "service-auto-radu"] } } });

  const irisPassword = await hashPassword("DemoIris2026!");
  const raduPassword = await hashPassword("DemoRadu2026!");

  const iris = await prisma.tenant.create({
    data: {
      name: "Salon Iris",
      slug: "salon-iris",
      publicKey: "pk_demo_saloniris",
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
          servicesJson: JSON.stringify([
            { name: "Tuns femei", detail: "45 min · 120 lei" },
            { name: "Vopsit", detail: "90 min · de la 250 lei" },
            { name: "Coafat ocazie", detail: "60 min · 180 lei" },
            { name: "Manichiură", detail: "45 min · 80 lei" },
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
          servicesJson: JSON.stringify([
            { name: "Revizie", detail: "60 min" },
            { name: "Diagnoză", detail: "45 min" },
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

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_no_double_book" ON "Appointment"("tenantId", "startsAt") WHERE "status" != 'cancelled'`,
  );
  console.log("Seed gata. Salon Iris și Service Auto Radu.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
