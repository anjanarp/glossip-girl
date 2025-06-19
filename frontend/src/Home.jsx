import { useState } from "react"
import "./Home.css"

function Home({ user }) {
  // state for file, deck name, and add button toggle
  const [file, setFile] = useState(null)
  const [deckName, setDeckName] = useState("")
  const [showAdd, setShowAdd] = useState(false)

  // handles file input change
  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    setFile(selected)
    if (selected && deckName) setShowAdd(true)
  }

  // handles deck name input change
  const handleDeckNameChange = (e) => {
    setDeckName(e.target.value)
    if (e.target.value && file) setShowAdd(true)
  }

  // handles add button click
  const handleAddClick = async () => {
    if (!file || !deckName || !user) return

    const reader = new FileReader()

    // reads the file content as text
    reader.onload = async () => {
      const fileContent = reader.result

      // prepares the payload to send to backend
      const payload = {
        uid: user.uid,
        deckName: deckName,
        content: fileContent,
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/upload-deck", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          console.log("Deck uploaded successfully")
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

  return (
    <div className="home-container">

      {/* instructions box for how to export from anki */}
      <div className="instructions-block">
        <p>
          <strong>How to export from Anki:</strong><br />
          Go to Anki → File → Export...<br />
          Choose “Cards in Plain Text (.txt)”<br />
          Uncheck “Include HTML and media references”
        </p>
      </div>

      {/* controls for importing file and naming deck */}
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

        {/* shows add button if both file and deck name exist */}
        {showAdd && (
          <button className="add-deck-button" onClick={handleAddClick}>
            ADD
          </button>
        )}
      </div>

    </div>
  )
}

export default Home