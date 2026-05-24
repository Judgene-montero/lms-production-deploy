# Production Deployment Guide

## Project structure

- `backend/`: Django API, admin, Channels, static and media handling
- `frontend/`: Create React App frontend for Vercel deployment
- `render.yaml`: Render blueprint for the Django web service and PostgreSQL database

## Important hosting limitation

General uploaded media can still use the local filesystem under `backend/media/`, which is not durable on free or basic stateless hosting.

Profile avatars are now designed to use Cloudinary in production so they survive Render restarts and redeploys. If the Cloudinary environment variables are missing, avatar uploads fall back to local storage for development.

## Backend environment variables

Set these in Render for the Django web service:

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS=your-backend-name.onrender.com`
- `DATABASE_URL=<Render PostgreSQL connection string>`
- `CORS_ALLOWED_ORIGINS=https://your-frontend-project.vercel.app`
- `CSRF_TRUSTED_ORIGINS=https://your-frontend-project.vercel.app`
- `CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>`
- `CLOUDINARY_API_KEY=<your-cloudinary-api-key>`
- `CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>`

Optional variables already supported:

- `JWT_SIGNING_KEY`
- `SECURE_SSL_REDIRECT=True`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- `SERVE_MEDIA_FILES=True`
- `DJANGO_CHANNEL_LAYER_BACKEND=memory`
- `DJANGO_EMAIL_BACKEND`
- `DJANGO_DEFAULT_FROM_EMAIL`

## Frontend environment variables

Set these in Vercel:

- `REACT_APP_API_BASE_URL=https://your-backend-name.onrender.com`
- `REACT_APP_WS_BASE_URL=wss://your-backend-name.onrender.com`

## Render setup

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and select the repo.
3. Confirm the generated PostgreSQL database and web service from `render.yaml`.
4. Update the service environment variables with your real Vercel domain and any custom domain.
5. Deploy the backend.
6. After the first deploy, open the service logs and verify:
   - dependencies installed successfully
   - `collectstatic` completed
   - migrations completed in the pre-deploy step
   - gunicorn started without import errors
   - avatar uploads return Cloudinary HTTPS URLs instead of `/media/avatars/...`

## Vercel setup

1. Import the same GitHub repo into Vercel.
2. Set the Root Directory to `frontend`.
3. Framework preset: `Create React App`.
4. Build Command: `npm run build`
5. Output Directory: `build`
6. Add the frontend environment variables above.
7. Deploy and confirm `vercel.json` route fallback is active for React Router paths.

## Deployment order

1. Deploy Render PostgreSQL and backend first.
2. Copy the final backend HTTPS URL.
3. Add that backend URL to Vercel env vars.
4. Deploy the frontend.
5. Add the final Vercel HTTPS URL back into Render:
   - `CORS_ALLOWED_ORIGINS`
   - `CSRF_TRUSTED_ORIGINS`
6. Redeploy the backend after updating those values.

## Smoke test checklist

After both services are live:

1. Open the Vercel frontend and confirm non-root routes load directly.
2. Register a user and verify the request reaches the Render backend.
3. Log in and confirm JWT token issuance still works.
4. Navigate protected pages for each role and confirm no auth redirect loop appears.
5. Check one or two existing API-backed pages to confirm normal UI behavior.
6. Open the Django admin or a known authenticated endpoint to confirm database connectivity.
7. Confirm static files load from the backend without 404 errors.
8. Upload a profile avatar and confirm the API returns a permanent Cloudinary URL such as `https://res.cloudinary.com/...`.
9. If your workflow uses other media uploads, note that non-Cloudinary local media persistence is still not guaranteed on free Render storage.
