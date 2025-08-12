# imports for fastAPI and transformer dependencies
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from sentence_transformers import SentenceTransformer
import firebase_admin
from firebase_admin import credentials
import pandas as pd
import numpy as np
import json
import os

import Levenshtein
from sklearn.metrics.pairwise import cosine_similarity


# firebase setup
#firebase_creds_path = os.environ.get("FIREBASE_CREDENTIALS", "service-account.json")
# cred = credentials.Certificate(firebase_creds_path)
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# embedding model set up
model = SentenceTransformer("all-MiniLM-L6-v2")

# initializing fastAPI
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class DeckUploadRequest(BaseModel):
    uid: str
    deckName: str
    content: str
    
class SimilarityRequest(BaseModel):
    uid: str
    word: str
    embedding: list[float]
    mode: str
    targetDecks: list[str]
    threshold: float

def delete_subcollection(parent_ref, subcollection_name, batch_size=500):
    sub_ref = parent_ref.collection(subcollection_name)
    docs = sub_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        delete_subcollection(parent_ref, subcollection_name, batch_size)
    
    
# uploads a .txt deck exported from anki, parses it into front/back pairs, 
# embeds both sides using sentence-transformers, splits them into chunks, 
# and stores it all in firestore under the logged-in user's deck
@app.post("/upload-deck")
async def upload_deck(payload: DeckUploadRequest):
    print("UPLOAD HIT:", payload.deckName)

    lines = payload.content.splitlines()
    parsed = []

    for line in lines:
        if line.strip() and not line.startswith("#"):
            if '\t' in line:
                front, back = line.split('\t', 1)
                parsed.append((front.strip(), back.strip()))
            else:
                print(f"Skipping malformed line: {line}")

    df = pd.DataFrame(parsed, columns=["front", "back"])
    entries = []

    for _, row in df.iterrows():
        front, back = row["front"].strip(), row["back"].strip()
        if not front or not back:
            continue

        try:
            front_emb = model.encode(front)
            back_emb = model.encode(back)
        except Exception as e:
            print("Encoding failed:", e)
            continue

        entries.append({
            "front": front,
            "back": back,
            "front_embedding": front_emb.tolist(),
            "back_embedding": back_emb.tolist(),
        })

    deck_ref = db.collection("users").document(payload.uid).collection("decks").document(payload.deckName)
    deck_ref.set({
        "uploaded_at": firestore.SERVER_TIMESTAMP
    })

    # clear old chunks if reuploading
    delete_subcollection(deck_ref, "chunks")

    # upload in size-safe chunks
    MAX_CHUNK_BYTES = 900_000
    chunk = []
    chunk_size = 0
    chunk_index = 0

    for entry in entries:
        entry_bytes = len(json.dumps(entry).encode("utf-8"))

        if chunk_size + entry_bytes > MAX_CHUNK_BYTES:
            deck_ref.collection("chunks").document(f"chunk_{chunk_index}").set({"entries": chunk})
            print(f"Uploaded chunk {chunk_index} with {len(chunk)} entries, size: {chunk_size} bytes")
            chunk_index += 1
            chunk = []
            chunk_size = 0

        chunk.append(entry)
        chunk_size += entry_bytes

    if chunk:
        deck_ref.collection("chunks").document(f"chunk_{chunk_index}").set({"entries": chunk})
        print(f"Uploaded final chunk {chunk_index} with {len(chunk)} entries, size: {chunk_size} bytes")

    return {"status": "success", "deck_id": payload.deckName}


# takes a selected word and its embedding, finds all entries across selected decks, 
# and returns a list of similar words based on cosine similarity or spelling distance,
# depending on the selected mode. uses precomputed embeddings from firestore chunks
@app.post("/compute-similarity")
async def compute_similarity(req: SimilarityRequest):
    user_ref = db.collection("users").document(req.uid)
    matches = []

    if req.mode == "definition":
        src_vec = np.array(req.embedding).reshape(1, -1)

    for deck_name in req.targetDecks:
        deck_ref = user_ref.collection("decks").document(deck_name)
        chunks_ref = deck_ref.collection("chunks")
        chunk_docs = chunks_ref.stream()

        for chunk_doc in chunk_docs:
            chunk_data = chunk_doc.to_dict()
            entries = chunk_data.get("entries", [])
            if not entries:
                continue

            if req.mode == "definition":
                valid_entries = [
                    e for e in entries
                    if e.get("front") and e.get("back") and "back_embedding" in e
                ]
                if not valid_entries:
                    continue

                target_vecs = np.array([e["back_embedding"] for e in valid_entries])
                scores = cosine_similarity(src_vec, target_vecs)[0]

                for i, score in enumerate(scores):
                    entry = valid_entries[i]
                    if entry["front"] == req.word:
                        continue
                    if score >= req.threshold:
                        matches.append({
                            "match": entry["front"],
                            "score": round(score, 3),
                            "front": entry["front"],
                            "back": entry["back"]
                        })
                    
                print(matches)

            elif req.mode == "spelling":
                for entry in entries:
                    tgt = entry.get("front", "")
                    if not tgt or tgt == req.word:
                        continue
                    edit_distance = Levenshtein.distance(req.word, tgt)
                    max_len = max(len(req.word), len(tgt))
                    if max_len == 0:
                        continue
                    similarity = 1 - (edit_distance / max_len)
                    if similarity >= req.threshold:
                        matches.append({
                            "match": entry["front"],
                            "score": round(similarity, 3),
                            "front": entry["front"],
                            "back": entry["back"]
                        })

    matches.sort(key=lambda x: -x["score"])

    return {
        "word": req.word,
        "similar_matches": matches
    }

port = int(os.environ.get("PORT", 8080))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=port)
