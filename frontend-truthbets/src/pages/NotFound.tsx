import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page container notfound">
      <p className="kicker">Page not found</p>
      <h1 className="notfound-code">404</h1>
      <p className="muted">This page was not part of the claim.</p>
      <p style={{ marginTop: 22 }}>
        <Link to="/" className="primary" style={{ padding: "12px 26px" }}>
          Back to the bets
        </Link>
      </p>
    </div>
  );
}
