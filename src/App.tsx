import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import MapPage from "./pages/MapPage";
import RegionsPage from "./pages/RegionsPage";
import HousesPage from "./pages/HousesPage";
import GrapesPage from "./pages/GrapesPage";
import VillagesPage from "./pages/VillagesPage";
import BestPage from "./pages/BestPage";
import TripsPage from "./pages/TripsPage";
import AskPage from "./pages/AskPage";

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/regions" element={<RegionsPage />} />
        <Route path="/houses" element={<HousesPage />} />
        <Route path="/grapes" element={<GrapesPage />} />
        <Route path="/villages" element={<VillagesPage />} />
        <Route path="/best" element={<BestPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/ask" element={<AskPage />} />
      </Routes>
    </>
  );
}
