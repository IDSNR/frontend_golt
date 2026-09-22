# Mobile authentication flow

## What this does

The mobile app now has a lightweight authentication entry screen that supports:

- Email + password sign up
- Email + password login
- Google OAuth sign in and account creation through Expo AuthSession

The screen is intentionally structured as a first step in a larger onboarding flow, so you can add more steps later such as:

- phone number entry
- parental consent
- profile completion
- agreement / terms acceptance

## Backend contract

The backend exposes these routes:

- POST /auth/register
- POST /auth/login
- POST /auth/google

### Request examples

Register:

```json
{
  "email": "user@example.com",
  "password": "P@ssword123",
  "displayName": "Demo User"
}
```

Login:

```json
{
  "email": "user@example.com",
  "password": "P@ssword123"
}
```

Google ID token:

```json
{
  "idToken": "eyJ..."
}
```

## Environment variables

Create a local environment file for the app before running it:

```bash
# mobile-app/.env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_REALTIME_URL=ws://localhost:8000/realtime
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

When the app is opened with Expo Go on a phone, it automatically replaces a
`localhost` API address with the computer address advertised by Expo. Keep the
phone and computer on the same network and start the backend on port 8000. An
explicit non-local address, such as a staging or production API, is never
rewritten.

Use `.env.example` as the starting point. The local `.env` file is ignored by
Git. All `EXPO_PUBLIC_*` values are visible in the compiled app, so they must
never contain private credentials.

For phone testing, production builds, push setup, and EAS build commands, read
`MOBILE_EXPO_COMPLETE_GUIDE.md`.

For the backend, you can override the password hashing salt if you want:

```bash
# backend/.env
AUTH_PASSWORD_SALT=change-me-in-production
```

## How it works

1. The Expo app sends auth requests to the FastAPI backend.
2. The backend hashes passwords with SHA-256 using a salt from the environment.
3. The app stores the returned session token in Expo SecureStore and restores it on the next launch.
4. Logout calls the backend revocation endpoint and removes the local token.
5. Google auth exchanges a Google ID token with the backend, which verifies it before issuing a PartnerHub session.

## Next steps

The public web client ID is used for the AuthSession request. The Google client secret must remain server-side and is not needed for this native ID-token flow.
