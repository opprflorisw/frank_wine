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
import ComparePage from "./pages/ComparePage";
import MyCellarPage from "./pages/MyCellarPage";
import ChatWidget from "./components/ChatWidget";
import SearchPalette from "./components/SearchPalette";

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
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/cellar" element={<MyCellarPage />} />
        <Route path="/ask" element={<AskPage />} />
      </Routes>
      <SearchPalette />
      <ChatWidget />
    </>
  );
}
