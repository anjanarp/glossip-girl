import { useState } from "react"
import "./Home.css"
import logo from "./assets/logo.png"

import { useEffect } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "./firebase.js"

function Home({ user }) {
  // state for uploaded file and deck name
  const [file, setFile] = useState(null)
  const [deckName, setDeckName] = useState("")
  const [showAdd, setShowAdd] = useState(false)

  // state for deck selections and similarity mode
  const [similarityMode, setSimilarityMode] = useState("definition")
  const [sourceDecks, setSourceDecks] = useState([])
  const [targetDecks, setTargetDecks] = useState([])

  // state for all decks and all fronts
  const [availableDecks, setAvailableDecks] = useState([])
  const [sourceFronts, setSourceFronts] = useState([])

  // state for search input
  const [searchTerm, setSearchTerm] = useState("")

  // state for similarity threshold
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5)

  // state for selected word and its definition
  const [selectedWord, setSelectedWord] = useState(null)
  const [selectedWordBack, setSelectedWordBack] = useState(null)

  // state for similar matches
  const [similarWords, setSimilarWords] = useState([])
  const [selectedSimilarWord, setSelectedSimilarWord] = useState(null)
  const [selectedSimilarWordBack, setSelectedSimilarWordBack] = useState(null)

  // handle file upload input
  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    setFile(selected)
    if (selected && deckName) setShowAdd(true)
  }

  // handle deck name input
  const handleDeckNameChange = (e) => {
    setDeckName(e.target.value)
    if (e.target.value && file) setShowAdd(true)
  }

  // upload the deck to backend
  const handleAddClick = async () => {
    if (!file || !deckName || !user) return

    const reader = new FileReader()
    reader.onload = async () => {
      const fileContent = reader.result
      const payload = {
        uid: user.uid,
        deckName: deckName,
        content: fileContent,
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/upload-deck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          console.log("Deck uploaded successfully")
          await fetchDecks()
        } else {
          console.error("Upload failed")
        }
      } catch (error) {
        console.error("Upload error:", error)
      } finally {
        setFile(null)
        setDeckName("")
        setShowAdd(false)
      }
    }

    reader.readAsText(file)
  }

  // get similar words for a selected word
  const fetchSimilarWords = async (front) => {
    const details = await fetchEntryDetails(front)
    if (!details) return

    setSelectedWordBack(details.back)

    const payload = {
      uid: user.uid,
      word: front,
      embedding: details.back_embedding,
      mode: similarityMode,
      targetDecks: targetDecks,
      threshold: similarityThreshold,
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/compute-similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (response.ok) {
        setSimilarWords(data.similar_matches || [])
      } else {
        console.error("Similarity fetch failed:", data)
      }
    } catch (err) {
      console.error("Error fetching similar words:", err)
    }
  }

  // toggle deck from selected lists
  const handleToggleDeck = (deck, target) => {
    const setFunc = target ? setTargetDecks : setSourceDecks
    const current = target ? targetDecks : sourceDecks
    setFunc(
      current.includes(deck)
        ? current.filter((d) => d !== deck)
        : [...current, deck]
    )
  }

  // fetch available deck names from firestore
  const fetchDecks = async () => {
    if (!user) return
    try {
      const decksRef = collection(db, "users", user.uid, "decks")
      const snapshot = await getDocs(decksRef)
      const deckNames = snapshot.docs.map((doc) => doc.id)
      setAvailableDecks(deckNames)
    } catch (err) {
      console.error("Error fetching decks:", err)
    }
  }

  // fetch decks when user loads
  useEffect(() => {
    fetchDecks()
  }, [user])

  // fetch all fronts from selected source decks
  useEffect(() => {
    const fetchFrontsFromSelectedDecks = async () => {
      if (!user || sourceDecks.length === 0) return

      let allFronts = []

      for (const deckName of sourceDecks) {
        try {
          const chunksRef = collection(db, "users", user.uid, "decks", deckName, "chunks")
          const chunkSnapshot = await getDocs(chunksRef)
          chunkSnapshot.forEach(doc => {
            const data = doc.data()
            if (data.entries) {
              const fronts = data.entries.map(entry => entry.front).filter(Boolean)
              allFronts.push(...fronts)
            }
          })
        } catch (err) {
          console.error(`Error fetching chunks for deck '${deckName}':`, err)
        }
      }

      console.log("Final collected fronts:", allFronts)
      setSourceFronts(allFronts)
    }

    fetchFrontsFromSelectedDecks()
  }, [user, sourceDecks])

  // get back and embedding for a single word
  const fetchEntryDetails = async (front) => {
    if (!user || sourceDecks.length === 0) return null

    for (const deckName of sourceDecks) {
      try {
        const chunksRef = collection(db, "users", user.uid, "decks", deckName, "chunks")
        const chunkSnapshot = await getDocs(chunksRef)

        for (const doc of chunkSnapshot.docs) {
          const chunk = doc.data()
          if (chunk.entries) {
            for (const entry of chunk.entries) {
              if (entry.front === front) {
                return {
                  back: entry.back,
                  back_embedding: entry.back_embedding,
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching embedding for word '${front}' in deck '${deckName}':`, err)
      }
    }

    return null
  }

  return (
    // whole home container
    <div className="home-container">

      {/* top row for import and mode toggles */}
      <div className="header-row">

        {/* import and add deck section */}
        <div className="importing-component">
          <div className="instructions-block">
            <p>
              <strong>How to export from Anki:</strong><br />
              Go to Anki → File → Export...<br />
              Choose “Cards in Plain Text (.txt)”<br />
              Uncheck “Include HTML and media references”
            </p>
          </div>

          <div className="import-controls">
            {file ? (
              <div className={`filename-wrapper ${file ? 'no-border' : ''}`}>
                <div className="uploaded-filename">{file.name}</div>
              </div>
            ) : (
              <label htmlFor="deck-file" className="import-deck-button">
                IMPORT DECK
              </label>
            )}

            <input
              id="deck-file"
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <div className="deck-name-input-wrapper">
              <input
                className="deck-name-input"
                type="text"
                placeholder="Deck Name"
                value={deckName}
                onChange={handleDeckNameChange}
              />
            </div>

            {showAdd && (
              <button className="add-deck-button" onClick={handleAddClick}>
                ADD
              </button>
            )}
          </div>
        </div>

        {/* source and pool deck selectors */}
        <div className="deck-selection-component">
          <div className="deck-selector-block">
            <button
              className="import-deck-button"
              onClick={() =>
                setSimilarityMode(
                  similarityMode === "definition" ? "spelling" : "definition"
                )
              }
            >
              MODE: {similarityMode.toUpperCase()}
            </button>

            <div className="deck-checkbox-lists">
              <div>
                <div className="checkbox-section-title">SOURCE DECKS</div>
                {availableDecks.map((deck) => (
                  <div key={deck} className="deck-checkbox-row">
                    <button
                      className={`deck-toggle-button ${sourceDecks.includes(deck) ? "active" : ""}`}
                      onClick={() => handleToggleDeck(deck, false)}
                      aria-label={deck}
                    />
                    <span className="deck-checkbox-label">{deck}</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="checkbox-section-title">POOL DECKS</div>
                {availableDecks.map((deck) => (
                  <div key={deck} className="deck-checkbox-row">
                    <button
                      className={`deck-toggle-button ${targetDecks.includes(deck) ? "active" : ""}`}
                      onClick={() => handleToggleDeck(deck, true)}
                      aria-label={deck}
                    />
                    <span className="deck-checkbox-label">{deck}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <img src={logo} alt="Glossip Girl Logo" className="top-logo" />
      </div>

      {/* lower content row for word selections and results */}
      <div className="below-header-row">

        {/* left side with selected fronts */}
        <div className="selected-fronts-wrapper">
          <div className="selected-fronts-block">
            <div className="checkbox-section-title">WORDS</div>
            <div className="selected-fronts-box">
              {sourceFronts
                .filter((front) =>
                  front.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((front, i) => (
                  <div
                    className={`selected-front ${front === selectedWord ? 'active' : ''}`}
                    key={i}
                    onClick={() => {
                      if (front === selectedWord) {
                        setSelectedWord(null)
                        setSelectedWordBack(null)
                        setSimilarWords([])
                        setSelectedSimilarWord(null)
                        setSelectedSimilarWordBack(null)
                      } else {
                        setSelectedWord(front)
                        fetchSimilarWords(front)
                      }
                    }}
                  >
                    {front}
                  </div>
                ))}
            </div>
          </div>

          {/* search bar for fronts */}
          <div className="fixed-front-search">
            <div className="front-search-input-wrapper">
              <input
                type="text"
                className="front-search-input"
                placeholder="search fronts"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* right side with definitions and matches */}
        <div className="similarity-right-wrapper">

          {/* side by side definitions */}
          <div className="definition-compare-block">
            <div className="definition-window">
              <div className="checkbox-section-title">ORIGINAL DEFINITION</div>
              <div className="definition-content">{selectedWordBack}</div>
            </div>
            <div className="definition-window">
              <div className="checkbox-section-title">SIMILAR DEFINITION</div>
              <div className="definition-content">{selectedSimilarWordBack}</div>
            </div>
          </div>

          {/* similar matches */}
          <div className="similarity-window">
            <div className="checkbox-section-title">SIMILAR WORDS</div>
            <div className="similarity-content">
              {similarWords.map((word, i) => (
                <div
                  key={i}
                  className={`selected-front ${word.front === selectedSimilarWord ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSimilarWord(word.front)
                    setSelectedSimilarWordBack(word.back)
                  }}
                >
                  {word.front}
                </div>
              ))}
            </div>
          </div>

          {/* slider for similarity threshold */}
          <div className="checkbox-section-title">SIMILARITY THRESHOLD</div>
          <div className="slider-wrapper">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="threshold-slider"
            />
            <div className="slider-value">{similarityThreshold.toFixed(3)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
