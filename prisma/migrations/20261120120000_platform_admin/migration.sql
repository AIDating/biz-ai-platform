-- Platform admin access and subscription billing.
-- Apply locally with `npx prisma migrate deploy` or `npx prisma db push`
-- after review. This migration is not applied by the application at boot.

-- Platform admins have no business. Existing owner rows keep their tenantId.
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Existing businesses become a Start trial until an admin or the seed sets them.
ALTER TABLE "Tenant" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'start';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "Tenant" ADD COLUMN "monthlyPricePence" INTEGER NOT NULL DEFAULT 4900;
ALTER TABLE "Tenant" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP';

CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPayment_tenantId_createdAt_idx" ON "SubscriptionPayment"("tenantId", "createdAt");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
