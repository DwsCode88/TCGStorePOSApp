# VaultTrove Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Firebase account
3. JustTCG API account
4. Square developer account
5. Vercel account (optional, for hosting)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Enable Authentication (Email/Password)
4. Enable Storage
5. Enable Cloud Functions
6. Go to Project Settings > Service Accounts
7. Generate new private key (for Firebase Admin)
8. Download the JSON file

## Step 3: Environment Variables

1. Copy `.env.example` to `.env.local`
2. Fill in all variables:
   - Firebase public config (from Firebase Console > Project Settings)
   - Firebase Admin credentials (from service account JSON)
   - JustTCG API key (from https://justtcg.com/dashboard)
   - Square credentials (from https://developer.squareup.com)

## Step 4: Deploy Firebase Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init

# Deploy rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

## Step 5: Square Setup

1. Go to Square Developer Dashboard
2. Create application
3. Get Production Access Token
4. Set up webhook:
   - URL: `https://yourdomain.com/api/webhooks/square`
   - Events: `order.created`, `order.updated`, `inventory.count.updated`
5. Create product categories for each game in Square Dashboard
6. Add category IDs to environment variables

## Step 6: Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## Step 7: Deploy to Vercel

1. Push code to GitHub
2. Import repository in Vercel
3. Add all environment variables
4. Deploy

## Step 8: Test

1. Search for a card in Intake
2. Add to inventory
3. Verify pricing calculations
4. Generate labels
5. Test Square sync

## Troubleshooting

- **Firebase Auth errors**: Check Firebase rules are deployed
- **JustTCG rate limits**: Check rate limit status in admin dashboard
- **Square sync issues**: Verify webhook signature is correct

## Next Steps

- Set up scheduled Cloud Functions for price updates
- Configure backup strategy
- Set up monitoring/alerts
- Train staff on system
