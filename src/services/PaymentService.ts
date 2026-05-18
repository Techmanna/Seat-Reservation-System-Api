import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export class PaymentService {
    private static paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
    private static stripeSecret = process.env.STRIPE_SECRET_KEY || '';
    private static flutterwaveSecret = process.env.FLUTTERWAVE_SECRET_KEY || '';

    public static async verifyPaystackTransaction(reference: string): Promise<any> {
        try {
            const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.paystackSecret}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json() as any;
            if (!response.ok || !data.status) {
                throw new Error(data.message || 'Paystack verification failed');
            }
            return data.data;
        } catch (error: any) {
            logger.error("[PaymentService] Paystack error:", error.message);
            throw error;
        }
    }

    public static async verifyStripeSession(sessionId: string): Promise<any> {
        try {
            const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.stripeSecret}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json() as any;
            if (!response.ok) {
                throw new Error(data.error?.message || 'Stripe verification failed');
            }
            return data;
        } catch (error: any) {
            logger.error("[PaymentService] Stripe error:", error.message);
            throw error;
        }
    }

    /**
     * Flutterwave Verification
     * @param transactionId - The ID of the transaction to verify
     */
    public static async verifyFlutterwaveTransaction(transactionId: string): Promise<any> {
        try {
            const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.flutterwaveSecret}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json() as any;
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Flutterwave verification failed');
            }
            return data.data;
        } catch (error: any) {
            logger.error("[PaymentService] Flutterwave error:", error.message);
            throw error;
        }
    }

    /**
     * Flutterwave Initialization (for USD/International)
     */
    public static async initializeFlutterwavePayment(payload: {
        tx_ref: string;
        amount: number;
        currency: string;
        redirect_url: string;
        customer: { email: string; name: string; phone?: string };
        meta?: any;
        payment_plan?: string;
        customizations?: { title: string; description: string; logo?: string };
    }): Promise<any> {
        try {
            const response = await fetch(`https://api.flutterwave.com/v3/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.flutterwaveSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json() as any;
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Flutterwave initialization failed');
            }
            return data.data; // contains the 'link' property for redirection
        } catch (error: any) {
            logger.error("[PaymentService] Flutterwave Init error:", error.message);
            throw error;
        }
    }
}
