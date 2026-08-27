# 🚀 Supabase Setup Guide — BidVerify AI

## Aapko kya karna hai (sirf 5 steps, 2 minute)

### Step 1: Supabase Project Banao (agar nahi hai)

1. **https://supabase.com/dashboard** pe jao
2. **"New project"** pe click karo
3. **Project name**: `bidverify` (ya kuch bhi)
4. **Database password**: kuch strong set karo (yaad rakho!)
5. **Region**: `ap-south-1` (Mumbai) select karo
6. **"Create new project"** pe click karo — 1-2 minute wait karo

### Step 2: Database Connection String Lo

1. Dashboard mein apna project kholo
2. **Left sidebar → Settings (gear icon) → Database**
3. Upar **"Connection string"** tab pe jao
4. **"URI"** tab select karo
5. **`Transaction` mode** wala connection string copy karo
6. Apna **database password** replace karo (jo Step 1 mein set kiya tha)

> Format dikhega:
> ```
> postgresql://postgres.xxxxxxxxxxxx:your-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
> ```

### Step 3: API Keys Lo

1. **Left sidebar → Settings → API**
2. Yahan se copy karo:
   - **Project URL** → `SUPABASE_URL` aur `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public`** key → `SUPABASE_ANON_KEY` aur `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: .env File Mein Paste Karo

`bidverify/.env` file kholo aur ye placeholders replace karo:

| Placeholder | Kahan se milega |
|---|---|
| `YOUR_PROJECT_REF` | Connection string mein `postgres.` ke baad wala part |
| `YOUR_PASSWORD` | Jo password Step 1 mein set kiya |
| `YOUR_PROJECT` | URL mein `https://` ke baad, `.supabase.co` se pehle |
| `YOUR_ANON_KEY` | Settings → API → `anon` key |
| `YOUR_SERVICE_ROLE_KEY` | Settings → API → `service_role` key |

### Step 5: Setup Script Run Karo

```bash
cd bidverify
bash setup-supabase.sh
```

Ye script automatically karega:
- ✅ Prisma client regenerate (PostgreSQL ke liye)
- ✅ Schema Supabase pe push
- ✅ Demo data seed (5 tenders, 15 bidders, 15 rules)
- ✅ Connection verify

### Bas Ho Gaya! 🎉

```bash
npm run dev
```

Open **http://localhost:3000** — Quick Demo Login use karo.

---

## Credentials Location (Quick Reference)

| Credential | Dashboard Path |
|---|---|
| Database URL | Settings → Database → Connection string → URI |
| Project URL | Settings → API → URL |
| Anon Key | Settings → API → anon `public` |
| Service Role Key | Settings → API → service_role |

## ⚠️ Security Notes

- **`SERVICE_ROLE_KEY`** ko kabhi frontend mein mat dalo
- **`.env`** file ko `.gitignore` mein rakho (already hai)
- Production mein `SESSION_SECRET` aur `ENCRYPTION_KEY` change karo
