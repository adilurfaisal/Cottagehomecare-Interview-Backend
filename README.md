# Secure Notes API

Express + MongoDB backend for Secure Notes — auth, notes, posts, and a small admin area. Runs on Vercel, DB lives on Atlas.

## Running locally

```
npm install
cp .env.example .env   # fill in your own values
npm run dev
```

## Scripts

- `npm run dev` – start with auto-reload
- `npm run seed` – add demo accounts/notes/posts (won't run with NODE_ENV=production)
- `npm run indexes` – (re)create Mongo indexes
- `npm run admin` – create the first admin user
- `npm test` – run the test suite

## Test accounts

Use the email address as the username on the login screen.

| Name | Email / username | Password | Role |
| --- | --- | --- | --- |
| Demo Admin | admin@example.com | adilur704300 | Admin |
| Adilur Rahman | adilur.faisal@gmail.com | adilur704300 | User |
| Maya Khan | maya@example.com | adilur704300 | User |
| Sam Wilson | sam@example.com | adilur704300 | User |

