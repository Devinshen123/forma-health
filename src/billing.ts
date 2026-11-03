export interface BillingPlan { code: string; name: string; amountCents: number; currency: string; monthlyPhotoLimit: number }
export interface BillingInvoice { id: string; number: string; status: string; paymentStatus: string; amountCents: number; currency: string; createdAt: string; periodStart: string | null; periodEnd: string | null }
export interface BillingSnapshot {
  mode: 'off' | 'sandbox'; available: boolean;
  reason: 'ready' | 'not_configured' | 'invalid_configuration' | 'service_unavailable';
  plans: BillingPlan[];
  subscription: { planCode: string; effectivePlanCode: string; status: string; paid: boolean; periodStart: string; periodEnd: string; cancelAtPeriodEnd: boolean } | null;
  usage: { used: number; reserved: number; limit: number; remaining: number; lagoReported: number | null; pendingEvents: number };
  invoices: BillingInvoice[];
}
