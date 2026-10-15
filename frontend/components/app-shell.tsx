"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  Cloud,
  Database,
  Globe2,
  House,
  Layers3,
  Menu,
  Moon,
  Orbit,
  Sun,
  X,
  GitCompareArrows,
} from "lucide-react";
import { useEnvironment } from "./providers";
import { CitySearch } from "./city-search";
import { Button } from "./ui/button";
const nav = [
  ["/", "Overview", House],
  ["/city", "City intelligence", ChartNoAxesCombined],
  ["/forecast", "Forecast studio", Cloud],
  ["/explorer", "Global explorer", Globe2],
  ["/comparison", "Comparison", GitCompareArrows],
  ["/models", "Model intelligence", Layers3],
  ["/data", "Data explorer", Database],
  ["/status", "System status", Activity],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { theme, toggleTheme, city } = useEnvironment();
  const [menu, setMenu] = useState(false);
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside
        className={`sidebar ${menu ? "is-open" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") setMenu(false);
        }}
      >
        <Link className="brand" href="/" aria-label="Atmosphere AI overview">
          <span className="orbital-brand">
            <Orbit size={51} strokeWidth={1} />
          </span>
          <span>
            ATMOSPHERE<span className="brand-ai">AI</span>
          </span>
        </Link>
        <button
          className="mobile-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.7} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-orbit">
            <Globe2 size={18} />
            <span>
              One planet.
              <br />
              <strong>A clearer perspective.</strong>
            </span>
          </div>
          <a
            href="https://open-meteo.com/en/docs/air-quality-api"
            target="_blank"
            rel="noreferrer"
          >
            Explore the data source <ArrowUpRight size={13} />
          </a>
          <small>CAMS model estimates</small>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </Button>
            <span>Workspace</span>
            <span className="crumb-divider">/</span>
            <strong>
              {nav.find(([href]) => href === path)?.[1] ?? "Overview"}
            </strong>
          </div>
          <div className="topbar-actions">
            <CitySearch />
            <Button
              variant="outline"
              size="icon"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="app-footer">
          <span>
            <span className="footer-dot" /> CAMS via Open-Meteo · Model
            estimates, not station measurements
          </span>
          <span>Times in {city.timezone}</span>
        </footer>
      </div>
    </div>
  );
}
