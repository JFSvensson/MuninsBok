import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>404 — Sidan hittades inte</h2>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Sidan du letade efter finns inte eller har flyttats.
      </p>
      <Link to="/dashboard">
        <button>Gå till översikten</button>
      </Link>
    </div>
  );
}
