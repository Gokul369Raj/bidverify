#!/bin/bash
# ============================================================
# BidVerify AI — Supabase Setup Script
# ============================================================
# Run this AFTER filling in your Supabase credentials in .env
#
# Usage: bash setup-supabase.sh
# ============================================================

set -e

echo "🚀 BidVerify AI — Supabase Setup"
echo "================================="

# Check if credentials are filled in
if grep -q "YOUR_PROJECT_REF" .env; then
  echo ""
  echo "❌ ERROR: Supabase credentials not filled in yet!"
  echo ""
  echo "Please edit .env file and replace these placeholders:"
  echo "  YOUR_PROJECT_REF  → from Supabase Database settings"
  echo "  YOUR_PASSWORD     → your database password"
  echo "  YOUR_PROJECT      → your Supabase project name"
  echo "  YOUR_ANON_KEY     → from Supabase API settings"
  echo "  YOUR_SERVICE_ROLE_KEY → from Supabase API settings"
  echo ""
  echo "Quick guide:"
  echo "  1. Go to https://supabase.com/dashboard"
  echo "  2. Open your project → Settings → Database"
  echo "  3. Copy 'Connection string → URI'"
  echo "  4. Go to Settings → API"
  echo "  5. Copy URL, anon key, and service_role key"
  echo ""
  exit 1
fi

echo ""
echo "📋 Step 1: Regenerating Prisma client for PostgreSQL..."
npx prisma generate

echo ""
echo "📋 Step 2: Pushing schema to Supabase PostgreSQL..."
npx prisma db push --accept-data-loss

echo ""
echo "📋 Step 3: Seeding demo data..."
npx tsx prisma/seed.ts

echo ""
echo "📋 Step 4: Verifying connection..."
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const count = await prisma.tender.count();
  const userCount = await prisma.user.count();
  console.log('  ✅ Tenders:', count);
  console.log('  ✅ Users:', userCount);
  await prisma.\$disconnect();
}
test().catch(e => { console.error('❌ Connection failed:', e.message); process.exit(1); });
"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Run the app:"
echo "  npm run dev"
echo ""
echo "Open: http://localhost:3000"
echo ""
echo "Demo Accounts:"
echo "  Officer:   rajesh.verma@procurement.gov.in / password123"
echo "  Bidder:    sunil.kumar@abcindustries.example / password123"
echo "  Admin:     admin@bidverify.ai / password123"
