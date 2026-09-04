# fac-recruitment-client

Public application pages and the manager dashboard for the FAC recruitment
portal. React + Vite + Tailwind.

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to the server on 5020
npm run build
```

Run the server alongside it — the dev proxy mirrors production, where nginx
serves this build and proxies `/api` on the same origin, so CORS never exists.

Scaffold only at present; stage 2 adds the application flow.
