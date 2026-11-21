
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, LayoutDashboard, QrCode, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    {
      label: "Officer Visit",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Police Station & Officers",
      path: "/police-stations",
      icon: Building2,
    },
    {
      label: "QR",
      path: "/location-qrs",
      icon: QrCode,
    },
  ];

  // Render sidebar content
  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo and Header */}
      <div className="relative flex items-center justify-center border-b border-gray-700 px-4 py-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-lg font-bold text-white">
            Admin Panel
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-4 text-white hover:bg-gray-700 hover:text-white lg:hidden"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {menuItems.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);

          return (
            <Button
              key={path}
              asChild
              variant="ghost"
              className={`h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                active
                  ? "bg-red-500 text-white hover:bg-red-600 hover:text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Link to={path}>
                <Icon className="h-5 w-5 shrink-0" />

                <span className="font-medium">
                  {label}
                </span>
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 bg-gray-900 text-white shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gray-900 text-white lg:flex">
        {renderSidebarContent()}
      </aside>
    </>
  );
}
