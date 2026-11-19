

import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../SideMenu/SideMenu";
import Header from "../Header/Header";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header setMobileOpen={setMobileOpen} />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}