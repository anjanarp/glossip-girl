# Glossip Girl: MVP README & Design Report


## 1) About this project

Glossip Girl is a browser‑based vocabulary exploration tool for personal study. It lets you:

- Import your own Anki decks (plain‑text export) into Firestore under your Google account.
- Toggle which decks act as **Source** (the words you’re studying) and which act as **Target** (the comparison pool).
- Switch **Mode** between **definition similarity** and **spelling similarity** and view tight neighbors.
- Enter a **Manage Decks** mode to review/delete decks without cluttering the study flow.

**What makes this different than the normal online dictionary or thesauras that lists similar synonyms and antonyms, is that it allows a user to leverage their own study decks from the popular Anki study tool in their own domain of study. For example, I found this to help my need of studying for the GRE Verbal Section, but what inspired me to make this was also my friend who was studying for the MCAT.**

Landing Page:
<img width="1512" height="944" alt="landing page" src="https://github.com/user-attachments/assets/0ed81f5c-9583-4b59-89e1-969dcb480f29" />

Modal to Import and Delete "Decks":
<img width="1512" height="943" alt="delete decks" src="https://github.com/user-attachments/assets/b1c419dd-e4ee-45de-9dfe-4694d1b884d6" />

Search specific "fronts" and find similar definitions:
<img width="1512" height="942" alt="find similar definitions" src="https://github.com/user-attachments/assets/044004a7-42bb-40de-a436-1078e5509873" />

Find similar spellings of a "front":
<img width="1512" height="942" alt="find similar spellings" src="https://github.com/user-attachments/assets/6ad1c25c-79f6-4ce7-9435-f83800a37dad" />




**Design priorities:**

- **Utility‑first for study:** fast, tight neighborhoods beat broad “topic maps.”
- **Simple to run:** minimal services; predictable Firebase + FastAPI split.
- **Aesthetic, not sterile:** retro pixel styling, high contrast, and a playful feel, unlike the familiar interface of Anki decks.

## 2) How to recreate this project in your own environment

### Frontend (Vite + React)

1. `npm install`
2. Create `.env` with Firebase web config (Vite: `VITE_*` keys):
   ```
   VITE_API_KEY=...
   VITE_AUTH_DOMAIN=...
   VITE_PROJECT_ID=...
   VITE_STORAGE_BUCKET=...
   VITE_MESSAGING_SENDER_ID=...
   VITE_APP_ID=...
   ```
3. `npm run dev`

### Backend (FastAPI)

1. Create venv and install deps:
   ```
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run locally:
   ```
   uvicorn main:app --reload
   ```

### Auth & Data

- Sign in with Google (Firebase Auth).
- Use **Import Deck** button. Follow on‑screen Anki export instructions (Cards in Plain Text; HTML/media unchecked).

### Deployment used in MVP

- **Frontend:** Firebase Hosting.
- **Backend:** Cloud Run (container). Firebase secrets provided within the environment.

## 3) Tech Stack at a Glance

- **UI:** Vite + React
- **Auth & DB:** Firebase Auth + Firestore
- **API:** FastAPI
- **Embedding:** sentence‑transformers (`all-MiniLM-L6-v2`)
- **Styling:** custom CSS, retro pixel aesthetic (Press Start 2P), bright pink palette, custom cursor


## 4) Data Model (Actual Behavior)

**Per‑user namespace (privacy by default):**

```
/users/{uid}/decks/{deckId}
```

**Deck storage in chunks:**

- Decks are split across multiple Firestore documents when needed.
- **Why:** Firestore has a hard 1 MB document size limit; chunking guarantees large decks can be stored safely.
- **Important:** In the MVP, all chunks for a deck are fetched when similarity runs. (An area to optimize in future iterations)
- Metadata kept minimal; the MVP focuses on the definitions/fronts needed for similarity.

## 5) Similarity Engine (MVP)

**Modes:**

- **Definition similarity:** compares definition text using precomputed embeddings and cosine similarity.
- **Spelling similarity:** compares word forms using Levenshtein distance.

**Threshold slider (UI):** users tune how tight neighborhoods are when using cosine similarity.

**Result shape:** a ranked list of neighbors.

**Why I chose not to use K‑Means instead of sparse cosine edges):**

- K‑Means yields coarse “topic” clusters, great for bird’s‑eye views but not for actionable review like “show me tight neighbors of *pugnacious*.”
- K forces you to guess and tweak the right amount of clusters, which can be unstable and may mix antonyms in dense spaces.
- Sparse cosine edges + a threshold slider map directly to study actions: interpretable neighborhoods, easy deck inclusion/exclusion, and a natural path to attaching root/antonym/confusable edges later.
- Edge computation is cacheable for future iterations, recomputation is only needed when data changes.

## 6) UI/UX Decisions

- **Two‑panel deck toggles:** Source (left) vs Target (right) mirrors the mental model of “what I’m testing” versus “what I’m searching through.”
- **Mode button (“MODE: DEFINITION/SPELLING”):** one active lens at a time to avoid clutter and mixed signals.
- **Manage Decks toggle:** deck deletion and housekeeping live off the main study surface; the delete “X” is hover‑revealed to prevent accidental clicks and visual noise.
- **Import instructions visible:** the dashed instruction box keeps the Anki export path obvious and reduces onboarding friction.

## 7) Known Limitations (Intentional for MVP)

- No graph visualization, results are rendered as lists.
- No deck sharing or collaboration.
- Similarity is not using any form of intentional in‑memory caching.
- All chunks for selected decks are loaded when computing similarity (no incremental/chunk‑level fetching yet).

## 8) How to Validate the MVP

1. Sign in (https://glossipgirlanki.com/) → import two small decks via `.txt` → mark one as Source and one as Target → toggle Mode → adjust threshold (sample datasets can be found here: [https://drive.google.com/drive/folders/1ANPXcGEhWBFHjz\_L9Vew4GQE9J1-jryZ?usp=sharing](https://drive.google.com/drive/folders/1ANPXcGEhWBFHjz_L9Vew4GQE9J1-jryZ?usp=sharing))
2. Enter **Manage Decks** → hover to reveal delete “X” → delete a deck → confirm it disappears from toggles and results.

