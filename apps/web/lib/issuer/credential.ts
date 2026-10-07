export interface IssuerFinancialClaims {
  annualRevenue: number;
  creditScore: number;
  totalDebt: number;
  businessAgeYears: number;
  latePayments: number;
}

export interface IssuerSignedFinancialCredential {
  id: string;
  type: "BUSINESS_FINANCIAL_CREDENTIAL";

  issuer: {
    id: string;
    name: string;
    publicKey: string;
  };

  subject: {
    id: string;
  };

  claims: IssuerFinancialClaims;

  issuedAt: string;
  expiresAt?: string;

  /**
   * Digital signature created by the issuer over
   * the credential contents.
   */
  signature: string;
}