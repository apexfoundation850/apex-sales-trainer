# Apex Sales Trainer

A single-page web app for training and developing foundation-repair sales reps at **Apex Foundation Specialists**. Covers the full sales cycle — from pre-appointment preparation through self-generated leads — with training modules, AI-driven role-play, behavioral assessments, field tools, and a manager dashboard for team oversight.

Live app: **https://apex-sales-trainer-dun.vercel.app/**

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Repository Layout](#repository-layout)
4. [Main File Anatomy](#main-file-anatomy-apex_sales_trainerhtml)
5. [User Roles](#user-roles)
6. [Features by Tab](#features-by-tab)
7. [Data Model](#data-model)
8. [Firestore Schema & Rules](#firestore-schema--rules)
9. [Serverless API Endpoints](#serverless-api-endpoints)
10. [Media & Content Storage](#media--content-storage)
11. [Development Workflow](#development-workflow)
12. [Deployment](#deployment)
13. [Common Operations](#common-operations)
14. [Known Design Decisions](#known-design-decisions)
15. [Future Roadmap](#future-roadmap)

---

## Architecture

Zero-build single-page app. Everything runs in the browser from one monolithic HTML file; dynamic features call three Vercel serverless functions that forward to the Anthropic API.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (PWA-capable)                       │
│                                                                 │
│   apex_sales_trainer.html  (≈7,600 lines)                       │
│   ├─ Inline CSS              (styles + responsive)              │
│   ├─ Firebase compat SDKs    (auth + firestore + storage)       │
│   └─ Inline JS               (all state, render, logic)         │
│                                                                 │
└──────────────────────────────────────────┬──────────────────────┘
                                           │
          ┌───────────────┬────────────────┼────────────────┐
          │               │                │                │
          ▼               ▼                ▼                ▼
  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐
  │ Firebase     │ │ Firebase    │ │ Firebase     │ │ Vercel /api     │
  │ Auth         │ │ Firestore   │ │ Storage      │ │ serverless      │
  │ (Google)     │ │ (user data) │ │ (video/audio)│ │ (Claude API)    │
  └──────────────┘ └─────────────┘ └──────────────┘ └─────────────────┘
                                                            │
                                                            ▼
                                                  ┌─────────────────┐
                                                  │ Anthropic       │
                                                  │ claude-sonnet-4 │
                                                  └─────────────────┘
```

**Why single-file:** fast to ship, easy to edit, no build step, no framework to keep up with. The team is one person (Ross) + AI assistance. Complexity lives in data, not infrastructure.

### Hosting

- **Vercel** hosts the static HTML and the `/api/*` serverless functions
- **Firebase** hosts auth + Firestore (user data, assignments, team objections, custom scripts) + Storage (media)
- **GitHub** — source of truth at `github.com/apexfoundation850/apex-sales-trainer` (`master` branch auto-deploys to Vercel)

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Frontend | Plain HTML/CSS/JS. No framework. |
| Auth | Firebase Auth (Google Sign-In, popup with redirect fallback) |
| Database | Firestore (compat SDK v10.12.2) |
| File storage | Firebase Storage |
| Serverless | Vercel functions (Node.js, ES modules) |
| AI | Anthropic Claude `claude-sonnet-4-20250514` |
| Browser APIs used | Web Speech API (voice features), Web Audio (mini-player), Fullscreen API, Media Session API, Clipboard API, visibilitychange |
| PWA | `manifest.json` with inline SVG icon |

---

## Repository Layout

```
Sales Trainer/
├── apex_sales_trainer.html    # SOURCE OF TRUTH — all app code
├── index.html                  # Mirror for Vercel root (must always match)
├── manifest.json               # PWA manifest
├── api/
│   ├── roleplay.js             # AI role-play scoring
│   ├── objection.js            # AI-crafted Apex-aligned objection responses
│   ├── script-practice.js      # Muscle-memory script delivery scoring
│   └── fix-quiz.js             # Utility endpoint (one-off data repair)
├── package.json                # Only pdf-parse deps for content extraction scripts
├── PROJECT.md                  # This file
│
├── .test-logs/                 # Overnight agent test logs (gitignored in practice)
├── .claude/                    # Claude Code workspace config (launch.json)
│
└── [historical content prep artifacts]
    ├── Apex_Sales_Training_Complete_Content.md
    ├── COMPILATION_SUMMARY.txt
    ├── 01-05 *.zip               (raw content archives)
    ├── expanded_drills.js        (pre-integration drill data)
    ├── expanded_flashcards.js
    ├── quiz_part1.js / part2 / part3
    ├── assessments_code.js
    ├── parse_scenarios.mjs
    └── extract_pdfs.mjs
```

**Important:** `apex_sales_trainer.html` and `index.html` **must be identical**. The workflow is: edit `apex_sales_trainer.html`, then `cp apex_sales_trainer.html index.html` before committing. Vercel serves `index.html`.

---

## Main File Anatomy (`apex_sales_trainer.html`)

≈7,600 lines, single file. Section map with approximate line numbers (they drift as features land):

| Lines | Section |
|-------|---------|
| 1–10 | HTML head, manifest link |
| 10–470 | Inline CSS (topbar, bottom nav, cards, forms, overlays, notifications, mini-player, script practice overlay, responsive rules) |
| 470–495 | Splash screen, sign-in page, offline banner, notifications panel |
| 495–510 | Module viewer, script practice overlay containers |
| 523–670 | `MODULES` — 12 modules (7 Core + 5 Job Type) with slide decks |
| 675–1130 | `QUIZZES` — 12 modules × 3 tiers × 10 questions = 360 questions |
| 1135–1395 | `FLASHCARD_DECKS` — study cards |
| 1398–1835 | `DRILLS` — objection-handling multiple-choice scenarios |
| 1837–1965 | `ROLEPLAY_SCENARIOS` — AI-coached live-practice scenarios |
| 1967–2090 | `discQuestions` — 20 DISC assessment items |
| 2090–2125 | `discProfiles` — D/I/S/C profile details |
| 2125–2145 | `BADGES` — gamification badges |
| 2145–2170 | `LEVELS` — Rookie → Master progression |
| 2170–2280 | Firestore `saveState`, `immediateSave`, load functions, realtime listeners |
| 2280–2470 | Auth state handler, welcome flow |
| 2470–2560 | Streak/points/badges, topbar updater |
| 2560–2760 | Navigation (`switchTab`, `renderLearn/Practice/More/Field`) |
| 2760–3100 | Field Tools: scripts library, custom scripts, extractors |
| 3100–3320 | Objection Logger (personal + team playbook) |
| 3320–3600 | Muscle-memory script practice (overlay, countdown, recording, scoring) |
| 3600–3800 | Home page (`renderHome`) |
| 3800–4240 | Quiz flow (tier selection, question, answer, results) |
| 4240–4640 | Drills + Role-Play (voice-enabled) |
| 4640–5270 | Assessments (DISC, Motivators, EQ — questions, profiles, result screens) |
| 5270–5640 | Module viewer, slide rendering, study timer, completion |
| 5640–5940 | Onboarding checklist, Certificates |
| 5940–5970 | `MEDIA` library (audio/video files on Firebase Storage) |
| 5970–6300 | Mini-player, expanded player, speech helpers |
| 6300–7400 | Manager dashboard (Overview, Reps, Assign, Grades, Role-Play, Analytics, Profiles, Settings + Rep Detail drill-in) |
| 7400–7630 | Utility functions, init, toast, escape helpers |

---

## User Roles

Role is a field on the user's Firestore doc (`users/{uid}.role`).

### Rep (default)
- Sees: Home, Learn, Media, Practice, More, Field Tools
- Can save/edit own profile data only
- Can submit role-play, log objections, complete assessments, take quizzes
- Can share objections to the team playbook

### Manager
- Everything a rep sees, plus:
  - **Manage Team** card inside More tab → opens manager dashboard (7 sub-tabs)
  - **Assign** — send modules, quizzes, drills, role-plays, or assessments to any rep
  - **Rep Detail drill-in** — see full breakdown of any rep, including manual edit panel
  - **Reset/Remove rep** — soft-delete via `deleted:true` tombstone
  - **Promote/Demote** — change any user's role
  - **Custom Scripts** — add/delete custom scripts for the team
  - **Delete team objections** — remove from team playbook
  - **Data Repair** — reconstruct missing fields from activityLog
  - **CSV Export** — export all rep data

First user to sign in is auto-promoted to manager. After that, the first-time check lists ≥1 user → new users default to `rep`.

---

## Features by Tab

Bottom nav has 5 tabs.

### 🏠 Home
- Welcome card (name, points, streak, level progress bar, "N pts to next level")
- **Continue** card — auto-detects the last activity (module, quiz, drill, role-play, flashcards) and offers a one-tap resume
- Onboarding checklist (hidden for veterans)
- **Field Tools** — 2-card grid: Scripts | Objection Logger
- **Your Stats** — 4-card grid: Modules / Quizzes / Drills / Role-Plays
- **Quick Actions** — 4 cards: Take a Quiz / Objection Drills / AI Role-Play / Podcasts
- Recent Activity (last 5)
- Badge grid (colored when earned)

### 📚 Learn (3 sub-tabs)
- **Modules** — 12 training modules with search, grouped by Core Sales Process and Job Type Education. Each has slides + speaker notes + quiz gate + optional embedded audio/video. Study time accumulates across sessions (`studyTimes` persists).
- **Quizzes** — 3-tier progression (Foundation → Advanced → Expert). 80%+ required to pass each tier and unlock the next. Fail locks the quiz until module is re-reviewed. Quiz access gated on module completion.
- **Cards** — flashcard decks with flip animation; active-recall button reveal (only shows "Review Again" / "Got It" after flip).

### 🎵 Media
- 17 audio/video files streamed directly from Firebase Storage
- **Mini-player** — pinned above bottom nav, persists across tab switches. Play/pause, -15s, +30s, progress bar, close button.
- **Expanded player** — tap art to open full controls: scrubber with elapsed/total time, speed (0.75×–2×), prev/next, minimize.
- **Play All Podcasts** — queues all 12 audio tracks in sequence.
- **Media Session API** for lock-screen controls on Android.

### ✅ Practice (2 sub-tabs)
- **Drills** — multiple-choice objection scenarios, 5+ categories, correct/wrong highlight with explanation.
- **Role-Play** — scenario list by category. Pick one → type OR **speak** (Web Speech API) a response → Claude returns: overall score (0–100), 5 sub-scores (empathy/diagnosis/evidence/technique/close), feedback, model response, tip. Responses adapted to the rep's DISC/Motivators/EQ profile.

### ⋯ More
- **Field Tools** card → opens `/pg-field` (Scripts + Objection Logger)
- **Leaderboard** — all reps sorted by points, with badges and level tags
- **Badges** — all 16 with descriptions
- **Assessments** card → opens DISC/Motivators/EQ launcher (respects 7-day retake cooldown)
- **Manage Team** card (managers only) → opens Manager Dashboard

### 📋 Field Tools (not a bottom nav item — reached via Home or More)
- **Scripts** — 26 sales scripts auto-extracted from module slide content, grouped by phase, searchable. Tap to expand for full text + Goal + Copy button + **🎤 Practice** button (muscle-memory drill). Managers can add custom scripts stored in Firestore. Each card shows practice history badge ("🎤 3× · 82%").
- **Objection Logger** — 3 sub-views:
  - **Log** — rep types what the customer said + context → Claude returns category, technique name, Apex-aligned response, follow-up question, "avoid" warning. Awards +5 points per log.
  - **Mine** — personal playbook (up to 100 entries), each tagged SHARED or PRIVATE
  - **Team** — everyone's shared objections, filterable by category, with author attribution

### 🎤 Muscle-Memory Script Practice (full-screen overlay)
4-phase flow launched from any script:
1. **Countdown** — read script with 10-second visible timer
2. **Recording** — script hides, mic pulses, live transcript shows
3. **Scoring** — Claude compares transcript to reference
4. **Results** — overall score + accuracy/tone/completeness (1–10 each), missing phrases, added filler, coaching, side-by-side comparison. +10 points per session.

---

## Data Model

### User document (`users/{uid}`)

```js
{
  name, email, photoURL, role ('rep' | 'manager'),
  points, streak, lastActive (toDateString),
  completedModules: ['mod1', ...],
  quizScores: {
    mod1: {best, last, attempts, failedAt?, restudied?, date},
    mod1_advanced: {...},
    mod1_expert: {...},
    ...
  },
  fcReviews, drillsCompleted, drillsPerfect,
  badges: ['first_mod', ...],
  activityLog: [{action, pts, time}, ...]  (capped 100, deduped within 5min),
  discResult, motivatorsResult, eqResult  (assessment payloads w/ completedAt),
  certificates: [{id, title, date}, ...],
  roleplayHistory: [{cat, scenario, score, scores, feedback, tip, date}, ...]  (cap 50),
  objectionPlaybook: [{id, objection, context, category, technique, response, followup, date, shared}, ...]  (cap 100),
  scriptPracticeHistory: [{scriptId, title, score, accuracy, tone, completeness, date}, ...]  (cap 50),
  studyTimes: {mod1: 12, mod2: 7, ...}  (minutes per module, accumulated),
  notifications: [{id, icon, text, action, time, read}, ...]  (cap 50),
  welcomeCompleted: bool, experience: 'new' | 'veteran',
  deleted?: true, deletedAt?, deletedBy?
}
```

### Assignment document (`assignments/{autoId}`)
```js
{
  repId, type ('module' | 'quiz' | 'drill' | 'roleplay' | 'assessment'),
  targetId, targetLabel, targetCount, currentCount,
  dueDate, status ('pending' | 'completed'),
  assigned (ISO), assignedBy (uid)
}
```

### Team Objections document (`teamObjections/{autoId}`)
```js
{
  objection, context, category, technique,
  response, followup,
  submittedBy (uid), submittedByName, date (ISO)
}
```

### Meta document (`meta/customScripts`)
```js
{
  scripts: [{id, title, category, text, createdBy, createdAt}, ...]
}
```

### In-Memory State (not persisted)
- `reps{}` — all users keyed by uid (kept in sync via realtime `onSnapshot`)
- `assignments{}` — all assignments
- `currentUid`, `currentRep`, `isManager`
- UI state: `learnTab`, `practiceTab`, `fieldTab`, `mgrTab`, `objectionView`, `expandedScriptId`, `expandedProfileRepId`, `selectedRepId`, `searchQuery`, `scriptSearchQuery`
- Flow state: `rpState`, `scriptPracticeState`, `quizState`, `drillState`, `discState`, `motivatorsState`, `eqState`, `fcState`

### Save Strategy
- **`saveState()`** — debounced 2s Firestore write
- **`immediateSave()`** — bypasses debounce; called on critical state changes (module complete, quiz result, assessment done, point change) and on `visibilitychange` (tab close / screen off)
- **Realtime `onSnapshot`** — keeps `reps{}` in sync across devices; auto-filters `deleted:true` tombstones

---

## Firestore Schema & Rules

### Collections
| Collection | Contents |
|------------|----------|
| `users/{uid}` | Per-user profile + all progress |
| `assignments/{autoId}` | Manager-assigned items |
| `teamObjections/{autoId}` | Shared objection playbook |
| `meta/customScripts` | Team-wide custom scripts (single doc) |

### Rules (canonical set — keep `firestore.rules` synced)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager';
    }

    match /assignments/{doc} {
      allow read, write: if request.auth != null;
    }

    match /meta/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager';
    }

    match /teamObjections/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.submittedBy == request.auth.uid;
      allow delete: if request.auth != null
        && (resource.data.submittedBy == request.auth.uid
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
      allow update: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager';
    }
  }
}
```

### Storage Rules (Firebase Storage)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /Media/{allPaths=**} {
      allow read: if true;
    }
  }
}
```

(Media files are publicly readable since they're not sensitive. Writes are admin-only via Firebase console.)

---

## Serverless API Endpoints

All endpoints: POST-only, CORS-open, require `ANTHROPIC_API_KEY` in Vercel env, use `claude-sonnet-4-20250514`.

### `/api/roleplay` — Role-play scoring
**In:** `{scenario, repResponse, category, discProfile?, motivatorsProfile?, eqProfile?}`
**Out:** `{overall_score (1-100), scores {empathy, diagnosis, evidence, technique, close (1-5)}, feedback, better_response, tip}`

### `/api/objection` — Apex-aligned objection coaching
**In:** `{objection, context?, discProfile?, motivatorsProfile?}`
**Out:** `{category, technique, technique_explanation, response, followup_question, warning}`

### `/api/script-practice` — Muscle-memory script scoring
**In:** `{reference, transcript, title}`
**Out:** `{overall_score (0-100), accuracy (1-10), tone (1-10), completeness (1-10), missing, added, coaching}`

### `/api/fix-quiz` — Utility (one-off data repair)
Rarely used; was built to patch specific quiz scoring issues during early testing.

---

## Media & Content Storage

### Firebase Storage (`gs://apex-sales-trainer.firebasestorage.app/Media/`)

| File | Module |
|------|--------|
| Mastering_the_Pre-Inspection_Phase__Setting_the_Stage_for_the_C.mp4 | mod1 |
| Apex_Foundation_Specialists__Module_2_—_The_Inspection_Phase.mp4 | mod2 |
| Mastering_the_Continuous_Close__Apex_Foundation_Specialists_Mod 3.mp4 | mod3 |
| Executing_the_Module_4_Close_Phase.mp4 | mod4 |
| Apex_Module_5_—_Post-Appointment_Follow-Up_System.mp4 | mod5 |
| Apex_Module_6__Customer_Psychology.mp4 | mod6 |
| Building_Science_Below_Grade__The_6-Component_Encapsulation_Eco.mp4 | jt3 |
| pre inspection Win_the_Sale_Before_You_Arrive.m4a | mod1 |
| inspection - Winning_the_sale_during_the_inspection.m4a | mod2 |
| presentation Closing_high_stakes_sales_with_silence.m4a | mod3 |
| close - Closing_sales_as_a_diagnostic_process.m4a | mod4 |
| follow up Winning_Sales_After_Leaving_The_House.m4a | mod5 |
| psychology - Why_Silence_Sells_Foundation_Repairs.m4a | mod6 |
| self gen - Escaping_the_Purchased_Lead_Treadmill.m4a | mod7 |
| Closing_High_Value_Foundation_Drainage_Sales.m4a | jt2 |
| Stop_the_crawl_space_moisture_cascade.m4a | jt3 |
| Selling_Poly_Injection_at_the_Kitchen_Table.m4a | jt4 |
| Sales_Strategies_for_Structural_Helical_Piers.m4a | jt5 |
| The_Physics_of_Interior_Drainage_Sales.m4a | jt1 |

**Modules missing video:** mod7 (Self-Generated Leads), jt1, jt2, jt4, jt5
**Modules with no audio podcast:** all 12 are covered.

### Module Content (`slidesId` in `MODULES`)
Slide decks are Google Slides documents embedded via iframe using each module's `slidesId`. Anyone with the link can view; controlled at Google Slides level.

---

## Development Workflow

### Local dev
```bash
# From repo root
npx serve -l 3001 --no-clipboard
# → http://localhost:3001
```
Hot-reload not available (by design). Refresh the browser to see changes.

Claude Code users: `.claude/launch.json` is pre-configured with a `sales-trainer` server at port 3001 for use with `preview_start`.

### Editing cycle
1. Edit `apex_sales_trainer.html` only (source of truth)
2. Validate the JS syntax:
   ```bash
   node -e "const fs=require('fs');const h=fs.readFileSync('apex_sales_trainer.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);fs.writeFileSync('_check.js',m[1]);" && node --check _check.js && rm _check.js
   ```
3. Mirror to Vercel's root:
   ```bash
   cp apex_sales_trainer.html index.html
   ```
4. Commit both, push to `master`. Vercel auto-deploys in ~30s.

### Commit style
Commits follow plain natural language (no Conventional Commits prefix required). Each commit ends with:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## Deployment

### Vercel
- Project auto-deploys from GitHub `master`
- Env var required: `ANTHROPIC_API_KEY` (set in Vercel dashboard → Settings → Environment Variables)
- Build: none (static). Serverless functions deploy from `/api/*.js`

### Firebase
- Auth: Google Sign-In enabled in Firebase Console → Authentication → Sign-in providers
- Firestore: enabled in Native mode
- Storage: bucket `apex-sales-trainer.firebasestorage.app`
- Rules: keep in sync with the schema section above (edit via Firebase Console → Firestore → Rules / Storage → Rules)

### First-run behavior
- New user signs in → Firestore checks if any user exists → if no users, the signed-in user becomes `role:'manager'`. Otherwise `role:'rep'`.
- New users also see a welcome flow offering "new" or "veteran" — veterans skip the onboarding checklist.

---

## Common Operations

### Add a new training module
1. Append a new object to `MODULES` in `apex_sales_trainer.html` with `id`, `section` (`'core'` or `'jobtype'`), `title`, `icon`, `slidesId`, `color`, and a `slides` array of `{t, c, n}` objects.
2. Add a matching `QUIZZES[<newId>]` entry with `foundation`, `advanced`, `expert` arrays of 10 questions each (10 tier × 3 = 30).
3. Optionally add media: append to `MEDIA` with `moduleId:<newId>`.
4. Onboarding steps and certificates may need to reference the new module ID.

### Add media files
1. Upload the file to Firebase Storage under `/Media/` (exact filename matters — script extractor uses it as the `src` key).
2. Append a new entry to the `MEDIA` array with `moduleId`, `title`, `type: 'video'|'audio'`, `src: fbMedia('filename.ext')`, `icon`.
3. Commit and push.

### Add a custom script (manager)
In-app: Field Tools → Scripts → "+ Add Custom Script" button. Stored in `meta/customScripts`.

### Repair a rep's missing data
If a rep's progress fails to persist (rare — caused by old debounced saves losing data), Manager → More → Manage Team → Settings → **Repair All Rep Data**. Reconstructs `lastActive`, `points`, `quizScores`, `completedModules`, `drillsCompleted` from each rep's `activityLog`.

### Manually edit a rep's fields
Manager → Manage Team → click a rep → scroll to bottom of detail view → Manual Edit panel. Toggles modules, quiz score inputs, edit points/streak/drills/card counts directly. Writes to Firestore immediately.

### Delete a user
Manager → Manage Team → Settings tab → **Delete** button next to rep. Soft delete (sets `deleted:true` tombstone) — prevents ghost-recreation if the rep is still signed in elsewhere. Cannot delete yourself.

### Export CSV
Manager → Overview tab → **Export All Data (CSV)** at the bottom. 15 columns including name, role, points, streak, modules, quiz averages, drills, role-plays, DISC, Motivator, EQ, last active.

---

## Known Design Decisions

| Decision | Reason |
|----------|--------|
| Single HTML file, no build | One-person maintenance; fast iteration |
| Firebase compat SDK (v10 compat, not modular) | Simpler inline usage; bundle size doesn't matter on first visit because of Vercel edge caching |
| Force `{source:'server'}` on initial reads, fall back to cache | Earlier offline persistence caused stale manager dashboards |
| `immediateSave()` on every critical action | Debounced saves were lost on mobile tab-kill; mission-critical data now writes synchronously |
| Quiz gate: must complete module first | Forces study before test; caught a critical circular-deadlock bug during testing (fixed) |
| Assessment 7-day retake cooldown | Prevents score-gaming and encourages genuine growth |
| `escapeHtml()` on all user-generated fields | Found confirmed-exploitable XSS in search bar during overnight testing; now rep names, AI output, transcripts, scripts, all rendered safely |
| Notification actions whitelist (`NOTIF_ACTIONS`) | Originally used `Function(n.action)()` — closed an arbitrary-code-execution path if Firestore notifications were ever tampered |
| Script content extracted from module slides at runtime | Single source of truth — editing a slide updates the scripts library automatically |
| Voice STT runs locally in browser only | No audio ever leaves the device. Only text transcripts reach the serverless endpoint. |
| Team objections default to shared | Captures team knowledge as a byproduct of individual practice |
| `.test-logs/` generated but not committed | Contains verbose overnight test runs; kept local for debugging |

### Fought-and-won bugs worth knowing
- **Module → Quiz navigation** bounced to Home. `startQuiz` was calling `switchTab('learn')` which re-rendered Learn and overwrote the quiz. Fix: switch tab manually without triggering re-render.
- **Study timer reset on app close.** Timer lived in memory, never persisted. Now accumulates in `studyTimes` via `saveModuleStudyTime()` on `closeModule()` and `visibilitychange`.
- **"Never logged in"** shown for active reps. `lastActive` wasn't hitting Firestore in time. Now `updateStreak` writes `lastActive` immediately, plus `getLastActive(r)` falls back to most-recent `activityLog` entry.
- **Recording wouldn't stop.** `onend` auto-restart closure re-triggered after user stop. Fix: null out all handlers before `stop()`, plus `abort()`, plus compare captured recognition instance to live ref before restarting.

---

## Future Roadmap

Ideas logged during development, not yet implemented. Listed roughly in perceived usefulness order:

| Idea | Notes |
|------|-------|
| Kitchen-Table Mode | Distraction-free single-tap view at an appointment — shows only Scripts + Objection Logger, hides training/gamification |
| Voice input for Objection Logger | Already have Web Speech pattern from voice role-play — easy port |
| Monthly AI coaching report | Claude summarizes each rep's month into a 1-page PDF for 1:1s |
| Coaching notes on role-plays | Manager writes targeted feedback on specific role-play sessions; shows on rep side |
| Peer highlights | Top-scoring role-plays shared as team examples |
| Goals + streak freeze days | Weekly goals with progress ring; 1-2 freeze days per month so vacation doesn't break streaks |
| Full proposal/quote builder | Line items, photos, totals, shareable PDF |
| Field checklists (kinesthetic) | Tap-through inspection checklists with photo upload + measurements, doubles as proposal evidence |
| Videos for remaining modules | mod7, jt1, jt2, jt4, jt5 still need video content |

---

## Questions / Operations Contact

This app is owned by **Ross Lee** (sales manager, Apex Foundation Specialists).

Questions while the app is running: open any console (F12) and check `window.reps`, `window.assignments`, `currentRep`, etc. — everything is in globals by design for quick debugging.
