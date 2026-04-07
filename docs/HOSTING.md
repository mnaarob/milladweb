# Hosting (Vercel only)

**Production:** [Vercel](https://vercel.com) — see **`docs/DEPLOY-VERCEL.md`**.

- Point **milladssupermarket.com** / **www** DNS to **Vercel** (project settings show the correct records).
- **Firebase Hosting is not used** for this site right now (old `firebase.json` / `.firebaserc` were removed). If you still see Firebase IPs or domains in DNS, update them to Vercel so traffic hits the right deploy.

Auth, database, and APIs use **Supabase**, not Firebase.
