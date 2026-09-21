import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Panel from './pages/Panel'
import Indoors from './pages/Indoors'
import Plants from './pages/Plants'
import IndoorDetail from './pages/IndoorDetail'
import Chat from './pages/Chat'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/panel" replace />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/indoors" element={<Indoors />} />
          <Route path="/plants" element={<Plants />} />
          <Route path="/indoors/:id" element={<IndoorDetail />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chatbot-test" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
