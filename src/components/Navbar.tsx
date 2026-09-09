import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/context/app-state";
import { cn } from "@/lib/utils";
import logo from "@/assets/mockpaper-logo.png";

export function Navbar() {
  const { user, logout } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    void navigate({ to: "/" });
  };

  const links = user
    ? [
        { to: "/", label: "Home" },
        { to: "/generate", label: "Generate" },
        { to: "/profile", label: "Profile" },
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-gold/35 bg-primary text-primary-foreground shadow-[0_8px_30px_-22px_oklch(0.1_0.06_258)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gold/30">
            <img
              src={logo}
              alt="MockPaper logo"
              width={30}
              height={30}
              className="size-7"
            />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            MockPaper
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-gold"
              activeProps={{
                className:
                  "bg-gold text-gold-foreground hover:bg-gold hover:text-gold-foreground",
              }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 gap-1.5 text-white hover:bg-white/10 hover:text-gold"
              onClick={handleLogout}
            >
              <LogOut className="size-4" /> Logout
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-gold"
              >
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm" variant="gold">
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </nav>

        <button
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-gold md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/10 bg-primary md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-gold"
              activeProps={{ className: "bg-gold text-gold-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button
              variant="outline"
              className="mt-2 gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-gold"
              onClick={handleLogout}
            >
              <LogOut className="size-4" /> Logout
            </Button>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-gold"
                onClick={() => setOpen(false)}
              >
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild variant="gold" onClick={() => setOpen(false)}>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
