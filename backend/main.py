# imports for fastAPI and transformer dependencies
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore
from sentence_transformers import SentenceTransformer
import firebase_admin
from firebase_admin import credentials
import pandas as pd
import uuid
# import Levenshtein
from metaphone import doublemetaphone

# firebase setup
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
    
    
# POST /upload_deck
"""
This route uploads a .txt Anki deck, parses it, generates semantic and form-based embeddings, 
and stores the deck in Firestore under the logged-in user
"""
@app.post("/upload-deck")
async def upload_deck(payload: DeckUploadRequest):
    
    print("UPLOAD HIT")
    print(payload.dict())
    
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

    # storing deck metadata
    deck_ref = db.collection("users").document(payload.uid).collection("decks").document(payload.deckName)
    deck_ref.set({"uploaded_at": firestore.SERVER_TIMESTAMP})


    # processing and storing entries
    for _, row in df.iterrows():
        front = row["front"]
        back = row["back"]
        entry = {
            "front": front,
            "back": back,
            "back_embedding": model.encode(back).tolist(),
            "front_embedding": model.encode(front).tolist(),
            "orthographic": {
                "length": len(front),
                "metaphone": doublemetaphone(front)[0],
                "raw_string": front
            }
        }
        deck_ref.collection("entries").add(entry)

    return {"status": "success", "deck_id": payload.deckName}
