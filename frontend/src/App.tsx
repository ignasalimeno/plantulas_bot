import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Indoors from './pages/Indoors'
import Plants from './pages/Plants'
import IndoorDetail from './pages/IndoorDetail'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/indoors" replace />} />
          <Route path="/indoors" element={<Indoors />} />
          <Route path="/indoors/:id" element={<IndoorDetail />} />
          <Route path="/plants" element={<Plants />} />
          <Route path="*" element={<Navigate to="/indoors" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
