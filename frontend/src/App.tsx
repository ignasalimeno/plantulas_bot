import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Panel from './pages/Panel'
import Indoors from './pages/Indoors'
import IndoorDetail from './pages/IndoorDetail'
import ChatbotTest from './pages/ChatbotTest'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/panel" replace />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/indoors" element={<Indoors />} />
          <Route path="/indoors/:id" element={<IndoorDetail />} />
          <Route path="/chatbot-test" element={<ChatbotTest />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
