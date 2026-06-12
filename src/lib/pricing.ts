import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICING, type PricingConfig } from "@/lib/geo";

// Laedt die Tarif-Konfiguration eines Unternehmens (per slug oder id).
export async function pricingForSlug(slug?: string | null): Promise<PricingConfig> {
  if (!slug) return DEFAULT_PRICING;
  const company = await prisma.company.findUnique({
    where: { slug },
    include: { pricing: true },
  });
  if (!company?.pricing) return DEFAULT_PRICING;
  return company.pricing as PricingConfig;
}

export async function pricingForCompanyId(companyId: string): Promise<PricingConfig> {
  const pricing = await prisma.pricing.findUnique({ where: { companyId } });
  return (pricing as PricingConfig) ?? DEFAULT_PRICING;
}
