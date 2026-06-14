import { Link } from "react-router-dom";
import { Icon } from "../lib/ui";
import { useRoute, toggleStop, isInRoute, type Stop } from "../lib/route";

// Add / remove a single house to "My Route". Used on the map sheet & houses list.
export function RouteButton({ stop, compact, className }: { stop: Stop; compact?: boolean; className?: string }) {
  const route = useRoute();
  const on = isInRoute(stop.id, route);
  return (
    <button
      type="button"
      className={`routebtn ${on ? "on" : ""} ${compact ? "compact" : ""} ${className || ""}`}
      title={on ? "In your route — tap to remove" : "Add to your wine route"}
      aria-pressed={on}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleStop(stop); }}
    >
      <Icon name="route" size={14} />
      {!compact && <span>{on ? "In route" : "Add to route"}</span>}
    </button>
  );
}

// Floating pill shown on the map when the route has stops — quick jump to /route.
export function RouteFab() {
  const route = useRoute();
  if (route.length === 0) return null;
  return (
    <Link className="route-fab" to="/route" title="View your wine route">
      <Icon name="route" size={16} />
      <b>{route.length}</b>
      <span>stop{route.length > 1 ? "s" : ""}</span>
    </Link>
  );
}
