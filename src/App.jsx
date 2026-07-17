import { useState, useRef, useEffect } from 'react'
import './App.css'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Plus, Trash2, Image as ImageIcon, Send, Bot, User, Sparkles, X, Key, Menu } from 'lucide-react'

function App() {
  const [chats, setChats] = useState(() => {
    const savedChats = localStorage.getItem('gemini_chats_history')
    return savedChats ? JSON.parse(savedChats) : []
  })

  const [activeChatId, setActiveChatId] = useState(() => {
    const savedChats = localStorage.getItem('gemini_chats_history')
    if (savedChats) {
      const parsed = JSON.parse(savedChats)
      return parsed.length > 0 ? parsed[0].id : null
    }
    return null
  })

  const [input, setInput] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobilny stan sidebaru
  
  const fileInputRef = useRef(null)
  const chatWindowRef = useRef(null)

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AQ.Ab8RN6K5mJrxk692lNd7HvCCXogCdsIBGg4QNcj90Tts1uJUJA";
  const genAI = new GoogleGenerativeAI(apiKey);

  useEffect(() => {
    localStorage.setItem('gemini_chats_history', JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight
    }
  }, [chats, activeChatId, loading])

  const activeChat = chats.find(c => c.id === activeChatId)
  const messages = activeChat ? activeChat.messages : []

  // Funkcja kompresująca obraz w locie (maksymalna szerokość/wysokość 800px, jakość 0.7)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 800
          const MAX_HEIGHT = 800
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // Konwersja na blob o obniżonej jakości i powrót do File
          canvas.toBlob((blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          }, 'image/jpeg', 0.7)
        }
      }
    })
  }

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({
          inlineData: {
            data: reader.result.split(',')[1],
            mimeType: file.type,
          },
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleNewChat = () => {
    const newId = Date.now().toString()
    const newChat = {
      id: newId,
      title: "Nowy czacik",
      messages: [],
      timestamp: new Date().toLocaleString('pl-PL')
    }
    setChats(prev => [newChat, ...prev])
    setActiveChatId(newId)
    setIsSidebarOpen(false) // Zamknij menu na mobile po wybraniu
  }

  const handleDeleteChat = (id, e) => {
    e.stopPropagation()
    const updatedChats = chats.filter(c => c.id !== id)
    setChats(updatedChats)
    if (activeChatId === id) {
      setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null)
    }
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setLoading(true) // Pokazujemy loader podczas kompresji lokalnej
      const compressed = await compressImage(file)
      setImage(compressed)
      setImagePreview(URL.createObjectURL(compressed))
      setLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() && !image) return
    if (!apiKey) {
      alert('Brak klucza API!')
      return
    }

    let currentChatId = activeChatId

    if (!currentChatId) {
      currentChatId = Date.now().toString()
      const newChat = {
        id: currentChatId,
        title: input.trim() ? (input.length > 25 ? input.substring(0, 25) + '...' : input) : "Rozmowa z obrazem",
        messages: [],
        timestamp: new Date().toLocaleString('pl-PL')
      }
      setChats([newChat])
      setActiveChatId(currentChatId)
    }

    const userMessage = {
      role: 'user',
      text: input,
      image: imagePreview,
    }

    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        const updatedTitle = chat.messages.length === 0 && input.trim()
          ? (input.length > 22 ? input.substring(0, 22) + '...' : input)
          : chat.title;

        return {
          ...chat,
          title: updatedTitle,
          messages: [...chat.messages, userMessage]
        }
      }
      return chat
    }))

setInput('')
    setImage(null)
    setImagePreview(null)
    setLoading(true)

    // Używamy jednego, w 100% działającego i najszybszego modelu
    const modelName = 'gemini-3.1-pro-preview'
    let responseText = ""
    let success = false
    let lastError = null

    try {
      console.log(`Połączenie z modelem: ${modelName}...`)
      const model = genAI.getGenerativeModel({ model: modelName })
      const promptParts = [input || "Przeanalizuj to zdjęcie."]

      if (image) {
        const imagePart = await fileToGenerativePart(image)
        promptParts.push(imagePart)
      }

      const result = await model.generateContent(promptParts)
      const response = await result.response
      responseText = response.text()
      success = true
    } catch (error) {
      console.error(`Błąd modelu ${modelName}:`, error)
      lastError = error
    }

    if (success) {
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, { role: 'ai', text: responseText }]
          }
        }
        return chat
      }))
    } else {
      const errorMessage = lastError?.message || "Błąd połączenia."
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, { role: 'ai', text: `Błąd API: ${errorMessage}` }]
          }
        }
        return chat
      }))
    }

    setLoading(false)
  }

  return (
    <div className="app-layout">
      {/* Tło przyciemniające do zamykania mobilnego sidebaru */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <h2>biocides.dev</h2>
          </div>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={18} /> Nowy czacik
          </button>
        </div>

        <div className="chats-list">
          {chats.length === 0 ? (
            <div className="no-chats-container">
              <p className="no-chats-placeholder">Brak historii rozmów</p>
            </div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat.id} 
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setIsSidebarOpen(false) // Zamknij menu na mobile po kliknięciu wątku
                }}
              >
                <div className="chat-item-info">
                  <span className="chat-item-icon">💬</span>
                  <span className="chat-item-title" title={chat.title}>{chat.title}</span>
                </div>
                <button 
                  className="delete-chat-btn" 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  title="Usuń czat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

      </aside>

      {/* GŁÓWNY PANEL */}
      <main className="main-content">
        <header className="app-header">
          <div className="header-meta">
            <button className="menu-toggle-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h1>Czat</h1>
            <span className="active-dot"></span>
          </div>
        </header>

        <div className="chat-container">
          <div className="chat-window" ref={chatWindowRef}>
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="welcome-icon-wrapper">
                  <Sparkles size={40} className="welcome-icon" />
                </div>
                <h3>Napisz do patyk ai</h3>
                <p>no pisz do tego czata</p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message-wrapper ${msg.role}`}>
                <div className="chat-message-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`chat-message ${msg.role}`}>
                  <p>{msg.text}</p>
                  {msg.image && (
                    <img src={msg.image} alt="Załącznik użytkownika" className="chat-image-attachment" />
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="chat-message-wrapper ai loading">
                <div className="chat-message-avatar loader-spin">
                  <Bot size={16} />
                </div>
                <div className="chat-message ai loading-bubble">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FORMULARZ WYSYŁANIA */}
          <form onSubmit={handleSend} className="chat-form">
            {imagePreview && (
              <div className="preview-container">
                <img src={imagePreview} alt="Podgląd" className="image-preview" />
                <button 
                  type="button" 
                  className="remove-image" 
                  onClick={() => { setImage(null); setImagePreview(null); }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="input-group">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="image-btn"
                onClick={() => fileInputRef.current.click()}
                title="Dodaj obraz"
              >
                <ImageIcon size={18} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Napisz coś..."
                className="text-input"
              />
              <button type="submit" className="send-btn" disabled={loading || (!input.trim() && !image)}>
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default App
