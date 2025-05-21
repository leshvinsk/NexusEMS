# Stripe Integration for NexusEMS

This document provides instructions on how to set up and use the Stripe payment integration in NexusEMS.

## Prerequisites

1. A Stripe account (you can create one at [stripe.com](https://stripe.com))
2. API keys from your Stripe Dashboard

## Setup Instructions

### 1. Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to Developers > API keys
3. Note your Publishable Key and Secret Key
   - For testing, use the keys that start with `pk_test_` and `sk_test_`
   - For production, use the keys that start with `pk_live_` and `sk_live_`

### 2. Update Environment Variables

1. Open the `server/.env` file
2. Update the following variables with your Stripe keys:
   ```
   STRIPE_SECRET_KEY=sk_test_your_test_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
   ```

3. Update the publishable key in the payment component:
   - Open `src/app/payment/payment.component.ts`
   - Find the line with `private stripePublishableKey = 'pk_test_51OtYXXXXXXXXXXXXXXXXXXXX';`
   - Replace it with your actual publishable key

### 3. Set Up Webhook (Optional but Recommended)

For production use, you should set up a webhook to receive payment events from Stripe:

1. In your Stripe Dashboard, go to Developers > Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/payments/webhook`
4. Select events to listen for (at minimum: `payment_intent.succeeded` and `payment_intent.payment_failed`)
5. After creating the webhook, note the "Signing secret"
6. Add this secret to your `.env` file:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

## Testing the Integration

### Test Cards

Use these test card numbers to simulate different scenarios:

- **Successful payment**: 4242 4242 4242 4242
- **Authentication required**: 4000 0025 0000 3155
- **Payment declined**: 4000 0000 0000 9995

For all test cards:
- Use any future date for the expiration date
- Use any 3-digit number for the CVC
- Use any postal code

### Test in the Application

1. Start your application
2. Navigate to the payment page
3. Fill in the form with test data
4. Use one of the test card numbers above
5. Complete the payment process

## Troubleshooting

If you encounter issues with the Stripe integration:

1. Check browser console for errors
2. Verify your API keys are correct
3. Make sure the server is running and accessible
4. Check Stripe Dashboard > Developers > Logs for detailed error information

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe.js Reference](https://stripe.com/docs/js)
- [Testing Stripe Payments](https://stripe.com/docs/testing) 