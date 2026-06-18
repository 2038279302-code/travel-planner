import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TripDetailPage from './pages/TripDetail';
import AiPlanner from './pages/AiPlanner';
import Discover from './pages/Discover';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="ai" element={<AiPlanner />} />
        <Route path="discover" element={<Discover />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
