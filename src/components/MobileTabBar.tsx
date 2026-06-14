import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "../lib/ui";
import { openSearch } from "../lib/search";
import { openChat } from "../lib/chat";
import { useRoute } from "../lib/route";

// Dedicated mobile navigation: a 5-slot bottom tab bar so the core of the app
// is one tap away (no digging through the hamburger menu).
export default function MobileTabBar() {
  const loc = useLocation();
  const route = useRoute();
  const onRoute = loc.pathname === "/route" || loc.pathname === "/routes";
  return (
    <nav className="mtab" aria-label="Primary">
      <NavLink to="/" end className={({ isActive }) => `mtab-i ${isActive ? "on" : ""}`}>
        <Icon name="map" size={21} /><span>Map</span>
      </NavLink>
      <NavLink to="/routes" className={() => `mtab-i ${onRoute ? "on" : ""}`}>
        <Icon name="route" size={21} /><span>Routes</span>
      </NavLink>
      <button type="button" className="mtab-i" onClick={() => openSearch()}>
        <Icon name="search" size={21} /><span>Search</span>
      </button>
      <NavLink to="/route" className="mtab-i mtab-myroute">
        <span className="mtab-badgewrap">
          <Icon name="pin" size={21} />
          {route.length > 0 && <b className="mtab-badge">{route.length}</b>}
        </span>
        <span>My route</span>
      </NavLink>
      <button type="button" className="mtab-i" onClick={() => openChat()}>
        <Icon name="chat" size={21} /><span>Franky</span>
      </button>
    </nav>
  );
}
