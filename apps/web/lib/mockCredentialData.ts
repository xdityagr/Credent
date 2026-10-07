import type { PrivateFinancialData } from "./crypto/proof";

/**
 * Mock private financial data used during development.
 *
 * This represents data that would eventually come from
 * a trusted financial data provider or signed credential.
 *
 * It must never be exposed as part of the public credential.
 */
export const privateFinancialData: PrivateFinancialData = {
  annualRevenue: 2_500_000,
  creditScore: 742,
  totalDebt: 320_000,
  businessAgeYears: 6,
  latePayments: 1,
};