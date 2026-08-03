# Mobile authentication flow

## What this does

The mobile app now has a lightweight authentication entry screen that supports:

- Email + password sign up
- Email + password login
- A Google placeholder flow that is easy to replace later

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

Google placeholder:

```json
{
  "email": "user@example.com",
  "displayName": "Demo User",
  "googleId": "replace-me-google-client-id"
}
```

## Environment variables

Create a local environment file for the app before running it:

```bash
# mobile-app/.env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=replace-me-google-client-id
```

For the backend, you can override the password hashing salt if you want:

```bash
# backend/.env
AUTH_PASSWORD_SALT=change-me-in-production
```

## How it works

1. The Expo app sends auth requests to the FastAPI backend.
2. The backend hashes passwords with SHA-256 using a salt from the environment.
3. The app stores the returned token locally in memory for the current session.
4. Google auth is currently a placeholder path that is ready to swap for a real OAuth provider once credentials are available.

## Next steps

When real Google credentials are ready, replace the placeholder value in the environment file and wire the app to a real OAuth flow such as:

- Expo AuthSession
- Google Sign-In for Expo
- Firebase Auth

The current layout should make it straightforward to add those pieces without redesigning the screen.
