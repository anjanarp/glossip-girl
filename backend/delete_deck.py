import firebase_admin
from firebase_admin import credentials, firestore


cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()


def delete_subcollection(parent_ref, subcollection_name, batch_size=500):
    sub_ref = parent_ref.collection(subcollection_name)
    docs = sub_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        print(f"Deleting doc {doc.id} in subcollection {subcollection_name}")
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        return delete_subcollection(parent_ref, subcollection_name, batch_size)


def delete_deck(uid, deck_name):
    deck_ref = db.collection("users").document(uid).collection("decks").document(deck_name)
    
    print(f"Deleting all entries in deck: {deck_name}")
    delete_subcollection(deck_ref, "entries")
    
    print(f"Deleting deck metadata: {deck_name}")
    deck_ref.delete()


user_id = "xxxxxxx"
deck_id = "GRE Roots"

delete_deck(user_id, deck_id)
