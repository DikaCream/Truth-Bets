import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { TruthBetsProvider } from "./context/TruthBetsContext";

// Route-level code splitting: each page is its own chunk, so the initial
// bundle only ships the shell + Home.
const Home = lazy(() => import("./pages/Home"));
const Bets = lazy(() => import("./pages/Bets"));
const Create = lazy(() => import("./pages/Create"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <TruthBetsProvider>
      <div className="bg-wash" aria-hidden="true" />
      <ScrollToTop />
      <Navbar />
      <main className="main">
        <Suspense
          fallback={
            <div className="page-loading" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              Loading region…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/bets" element={<Bets />} />
            <Route path="/create" element={<Create />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </TruthBetsProvider>
  );
}
