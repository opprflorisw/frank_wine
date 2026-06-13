import { Link } from "react-router-dom";
import { Icon, BackBar } from "../lib/ui";
import { useFavorites, removeFav, clearFavs } from "../lib/favorites";
import { openChat } from "../lib/chat";

export default function MyCellarPage() {
  const favs = useFavorites();
  const houses = favs.filter((f) => f.type === "house");
  const regions = favs.filter((f) => f.type === "region");

  return (
    <div className="page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "My Cellar" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>My Cellar</h1>
        <p className="lede">Your saved wine houses and regions, kept on this device. Tap the ★ on any house or region to add it here.</p>
      </div>

      {favs.length === 0 ? (
        <div className="empty cellar-empty">
          <div className="big">★</div>
          <p>Nothing saved yet. Browse the map or the houses list and tap the star to build your cellar.</p>
          <div className="suggest"><Link className="chip" to="/houses">Browse houses</Link><Link className="chip" to="/">Open the map</Link></div>
        </div>
      ) : (
        <>
          <div className="cellar-actions ui">
            <span className="resultcount">{houses.length} houses · {regions.length} regions</span>
            <button className="btn sm" onClick={() => clearFavs()}><Icon name="bottle" size={13} /> Clear all</button>
          </div>

          {regions.length > 0 && (
            <div className="cellar-sec">
              <h3 className="cellar-h"><Icon name="grid" size={14} /> Regions</h3>
              <div className="cellar-grid">
                {regions.map((f) => (
                  <div className="cellar-card" key={f.id}>
                    <Link className="cc-main" to={f.to}><b>{f.label}</b><span>{f.sub}</span></Link>
                    <button className="cc-x" title="Remove" onClick={() => removeFav("region", f.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {houses.length > 0 && (
            <div className="cellar-sec">
              <h3 className="cellar-h"><Icon name="bottle" size={14} /> Wine houses</h3>
              <div className="cellar-grid">
                {houses.map((f) => (
                  <div className="cellar-card" key={f.id}>
                    <Link className="cc-main" to={f.to}><b>{f.label}</b><span>{f.sub}</span></Link>
                    <button className="cc-ask" title={`Ask Franky about ${f.label}`} onClick={() => openChat(`Tell me about ${f.label} — its wines and whether I can visit.`)}><Icon name="chat" size={13} /></button>
                    <button className="cc-x" title="Remove" onClick={() => removeFav("house", f.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
