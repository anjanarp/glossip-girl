import { useState, useEffect } from "react"
import { Routes, Route, useNavigate } from "react-router-dom"
import { signInWithPopup } from "firebase/auth"
import { auth, provider } from "./firebase.js"
import { onAuthStateChanged } from "firebase/auth"

import Home from "./Home.jsx"
import ProtectedRoute from "./ProtectedRoute"
import "./App.css"
import logo from "./assets/logo.png"
import border from "./assets/landing-border.png"

function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  // handles google login and routing
  const handleLogin = () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user)
        navigate("/home")
      })
      .catch((error) => {
        console.error("Google Sign-In Error:", error)
      })
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
      }
    })

    return () => unsubscribe()
  }, [])

  // sets up routing for landing and home
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="app-container">
            <img src={border} alt="frame" className="landing-border" />
            <div className="landing-content">
              <img src={logo} alt="Glossip Girl logo" className="logo" />
              <button className="pixel-button" onClick={handleLogin}>
                Sign in with Google
              </button>
            </div>
          </div>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home user={user} />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
