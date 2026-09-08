# Frontend Social Media Plan

This document describes the next phase of the mobile frontend after auth and onboarding, with a clear breakdown of every screen and data flow needed for a standard social media experience.

## Purpose

- Build the mobile social experience around a feed, profile, search, DMs, and stories.
- Keep the UI modular and easy to extend after onboarding.
- Use the existing backend contracts where possible.
- Keep major style decisions on hold until you approve them.
- Keep media link handling ready for the frontend, but do not hard-code real storage links yet.

## Suggested file name

`mobile-app/FRONTEND_SOCIAL_MEDIA_PLAN.md`

## Existing state

Frontend currently has:
- `App.tsx`: signup/login, session restoration, and the existing Google auth path.
- `App.tsx`: feed, search, community, direct-message, and profile sections.
- `App.tsx`: native mobile video playback, story viewing, engagement, follow state, profile editing, push registration state, and live-message connection state.
- `App.tsx`: Amazon-first physical-product cards and a native browser handoff that does not render Amazon inside an embedded WebView.
- `README-authentication.md`: backend contract for auth routes.

Backend currently exposes:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /profiles/me`
- `GET /profiles/handle/{handle}`
- `GET /feed`
- `POST /feed/{content_id}/view`
- `POST /media/upload` (placeholder, returns a fake URL)
- `GET /stories/by/{creator_id}`
- `POST /stories`
- `POST /stories/{story_id}/view`
- `POST /content/{content_id}/affiliate-links`
- `POST /affiliate-links/{offer_id}/open`
- `GET /content/{content_id}/affiliate-attribution`

## Physical product affiliate flow

Creators can optionally attach one or more physical products to a post. Amazon is the first retailer, but the frontend uses a provider field and a shared product-card shape so later retailers can be added without replacing the feed.

The current flow works as follows:

1. The creator publishes a media post and optionally supplies a product title plus a direct Amazon product-details URL.
2. The backend creates the post first, then creates the affiliate offer owned by that creator. If the offer fails validation, the post stays live and the app explains that the product was not attached.
3. The feed returns safe card data, not the stored outbound URL.
4. The card identifies the item as a physical product sold on Amazon, states that Amazon controls price, checkout, delivery, and returns, and displays the required affiliate disclosure.
5. A deliberate tap asks the backend to record the click and return the approved destination. The app opens it with the device's native browser surface or Amazon app. It does not use an embedded WebView.
6. Clicks remain separate from confirmed purchases. Creator commission stays at zero until Amazon reports confirm an eligible order and Golt has an approved attribution policy.

Before production, Golt still needs Amazon Associates approval for the mobile app, Golt-owned marketplace tracking IDs, a founder-approved creator commission policy, and a compliant report-reconciliation method. The app must not promise cashback to viewers, add a markup to Amazon's price, or describe creator commission as a processing fee or tip.

Backend data model references:
- `backend/app/modules/content/service.py`: post service expects `videoUrl` or `mediaItems`.
- `backend/app/modules/stories/service.py`: story service expects `mediaUrl` and `mediaType`.
- `backend/data_management/models.py`: `PostMedia.media_url`, `Story.media_url`, `Post.media` relationship.

## Minimum viable frontend features

### 1. Main app shell and navigation

The app should move from auth into a tab-based main experience:
- `Feed` tab
- `Search` tab
- `DMs` tab
- `Profile` tab (or `Me` tab)

Each tab is its own top-level section. This keeps the experience familiar and easy to navigate.

### 2. Feed tab

The Feed is the heart of the app.

Key features:
- Vertical, swipeable/scrollable feed of media posts.
- Each post may contain a video or one or more image media items.
- Post metadata: author handle, display name, avatar, caption, view count, like/bookmark/action buttons, time.
- A story row above the feed, showing active stories as tappable creator cards.
- Tap on a post to see more details or open comments (future extension).
- Track views via `POST /feed/{content_id}/view` with optional completion flag.
- Load fresh feed data from `GET /feed`.

Frontend data shape should include:
- `id`
- `creatorId`
- `creatorHandle`
- `creatorDisplayName`
- `creatorAvatarUrl`
- `caption`
- `mediaItems` array with `id`, `mediaType`, `url`, `thumbnailUrl?`, `orderIndex?`
- `videoUrl` if the post is a single video.
- `visibility`
- `created_at`
- `views`, `completions`

### 3. Search tab

This is a separate tab with searching and discovery.

Key features:
- Search input at top.
- Recent searches / trending tags / recommended creators.
- Search results page with creators and posts.
- Search should query user handles and public posts.

Suggested backend support:
- `GET /search?query=...` (not yet implemented)
- `GET /profiles/handle/{handle}` for profile resolution.

### 4. DMs tab

Direct messages should be a separate top-level tab.

Key features:
- Conversation list sorted by most recent message.
- Conversation preview line and unread badge.
- Thread view with messages and attachments.
- Text entry and send button.
- Support image/video attachments via the same upload flow used by feed/story media.

Backend note:
- The backend currently has no DM API routes in `mobile-app` or backend route files other than data model declarations in `backend/data_management/models.py`.
- DM storage and API should be defined before implementation.

### 5. Profile page

A profile screen must load a user’s public data and show edit controls when the profile belongs to the signed-in user.

Key features:
- Public profile data:
  - avatar
  - display name
  - handle
  - bio
  - follower/following counts
  - post count
  - public posts grid / list
  - stories row for that creator
- If the signed-in user is viewing their own profile:
  - `Edit profile` button
  - `Settings` button (optional for later)
- If viewing another user:
  - Follow / request follow / message buttons
  - Public posts only, unless private account access is allowed.

Backend contract:
- `GET /profiles/handle/{handle}` returns `profile` and `content`.
- `GET /profiles/me` returns current user profile.

### 6. Profile editing UI

This should be a dedicated screen from the profile view.

Fields:
- Display name
- Handle
- Bio
- Avatar upload
- Privacy toggle (`isPrivate`)
- Optional links or metadata fields if needed later

Behavior:
- Load current profile values from `GET /profiles/me`.
- Save changes to a profile update route when available.
- Allow avatar selection from camera or gallery, using `POST /media/upload` or future storage flow.

### 7. Stories

Stories should be visible on top of the feed and available from the profile.

Key features:
- Stories row with creator circles.
- Tap to open a story viewer.
- Swipe through a creator’s active stories.
- Story metadata: creator name, time, optional caption.
- Mark story view by calling `POST /stories/{story_id}/view`.
- Load active stories via `GET /stories/by/{creator_id}`.

### 8. Media upload linkability

The frontend must treat media as linkable resources but not require real storage yet.

Current backend placeholder:
- `POST /media/upload` accepts an uploaded file and returns a fake URL:
  - `https://partnerhub.test/media/{filename}`
- This is enough for frontend wiring and testing the upload flow.

The frontend should:
- Upload an image/video file to `/media/upload`.
- Accept the returned `url` and use it in post or story payloads.
- Keep the upload result decoupled from display logic.

Do not hard-code production media URLs until the storage design is approved.

## Media delivering system

This section outlines the full media delivery strategy an engineer or AI would need.

### 1. Overall strategy

Social media platforms generally separate data and media:
- Metadata and text live in the app API.
- Actual images/videos live in object storage or a CDN.
- The app receives links to media resources and renders them.

For this app, the assumed strategy is:
- Client uploads media to backend or directly to storage.
- Backend stores a reference (`mediaUrl`) in the content/story record.
- Feed and story APIs return those URLs in their payloads.
- The frontend can then render or play the URLs.

### 2. Upload flow

There are two viable upload strategies:

1. Backend relay upload
   - Client sends file to backend endpoint (`POST /media/upload`).
   - Backend stores the file in persistent storage and returns a media URL.
   - Pros: simple, easier to secure.
   - Cons: backend bandwidth and scaling.

2. Direct signed upload
   - Client requests a signed upload credential from backend.
   - Client uploads the file directly to storage service.
   - Backend stores the resulting URL in the post/story record.
   - Pros: scales better for large video media and mobile upload.
   - Cons: slightly more complex implementation.

Current backend is placeholder only, so choose whether to keep the simple relay approach or move to signed upload before implementation.

### 3. Storage handling

The backend should store media metadata, not raw content, in the app database.

At minimum, store:
- `media_url`
- `media_type` (`image` or `video`)
- `content_type` (`image/jpeg`, `video/mp4`, etc.)
- `thumbnail_url` for videos
- `order_index` for multi-item posts
- `created_at`

Potential storage services:
- Supabase Storage (matches project plan)
- AWS S3 / CloudFront
- Google Cloud Storage
- Cloudinary or Imgix for automatic transformation

Because the current backend already has `post_media` and `stories.media_url`, implementing storage should be the next backend step once you approve the architecture.

### 4. Delivery and playback

The frontend should support these delivery patterns:
- `image` media: render with a fast image component.
- `video` media: render inline or as a full-screen player.
- `thumbnailUrl`: show before the full video loads.
- `mediaType`: determine playback controls and sizing.

For stories:
- Use `expiresAt` if available to drop expired stories.
- Use `mediaUrl` for the active story frame.
- Use `POST /stories/{story_id}/view` to track engagement.

### 5. API payload design

The API should return lightweight, normalized objects.

Examples:

Feed post:
```json
{
  "id": "content-123",
  "creatorId": "user-1",
  "creatorHandle": "@example",
  "creatorDisplayName": "Example User",
  "creatorAvatarUrl": "https://.../avatar.jpg",
  "caption": "Check this out",
  "mediaItems": [
    { "id": "media-1", "mediaType": "image", "url": "https://...", "orderIndex": 0 }
  ],
  "videoUrl": null,
  "visibility": "public",
  "created_at": "2026-08-05T12:00:00Z",
  "views": 123,
  "completions": 45
}
```

Story payload:
```json
{
  "id": "story-12",
  "creatorId": "user-1",
  "mediaType": "video",
  "mediaUrl": "https://...",
  "caption": "Behind the scenes",
  "created_at": "2026-08-05T12:00:00Z",
  "expiresAt": "2026-08-05T16:00:00Z"
}
```

### 6. Security and privacy

Required safeguards:
- Public posts can use public URLs.
- Private/protected posts should use signed URLs or backend proxy fetch.
- Story views should only be available to authorized viewers if the account is private.
- The frontend should not assume all returned URLs are safe; handle errors gracefully.

### 7. Caching and performance

For mobile performance:
- Use local image/video caching if available.
- Preload story media as needed.
- Avoid re-fetching the same media URLs too often.
- Keep the feed payload small; lazy-load media details when possible.

### 8. Error handling

The frontend must handle:
- upload failures
- invalid or expired media URLs
- unsupported media types
- network interruptions

It should show a fallback state rather than crashing.

## Proposed frontend structure

### Navigation / screens

- `AuthScreen` / `OnboardingScreen` (existing)
- `MainTabs`
  - `FeedScreen`
  - `SearchScreen`
  - `DmsScreen`
  - `ProfileScreen`
- `StoryViewerScreen`
- `ProfileEditScreen`
- `PostDetailScreen` (future)
- `MediaUploadScreen` or modal

### Components

- `PostCard`
- `StoryBubble`
- `SearchBar`
- `MessageThreadCard`
- `ProfileHeader`
- `MediaGallery`
- `VideoPlayer`
- `Avatar`

## Style guidance

Based on `style.md`:
- Primary colors: `#ffcc2c` and `#6bcc61`.
- Keep colors as theme variables; avoid hard-coding them.
- Aim for minimalist and modern; a more refined take than Instagram/TikTok.
- Use a yellow-to-green gradient in select hero or accent areas.
- Accept neutral black/white blocks for large backgrounds.
- Do not finalize the exact palette or component design without your sign-off.

## Backend storage and implementation recommendation

### Current state
- Storage is currently placeholder-only: `/media/upload` returns `https://partnerhub.test/media/{filename}`.
- `ContentService` and `StoryService` already expect `mediaUrl` or `videoUrl` values.

### What is needed next
- Decide whether to keep the simple relay upload design or move to signed direct upload.
- If storage is needed, implement:
  - a real persistent object store (Supabase Storage or equivalent),
  - a backend upload API that stores files and returns actual CDN/hosted URLs,
  - database persistence for `PostMedia` and `Story` media URLs.

### Recommendation
- For initial frontend development, keep the placeholder route and use the returned URL as a link.
- Before production-ready media, add storage handling in the backend only after you confirm the architecture.

## Next step

1. Provision production object storage and a CDN, then replace local media URLs with signed upload and delivery URLs.
2. Complete Amazon Associates mobile-app approval and configure the Golt-owned tracking ID only after approval.
3. Decide the creator share of net, confirmed affiliate income and how reversals will be handled.
4. Split the monolithic `App.tsx` into maintained screens and components before adding more major UI surfaces.
