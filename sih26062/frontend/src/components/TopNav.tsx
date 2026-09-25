import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { clearAuth } from '../state/auth';

export default function TopNav() {
  const loc = useLocation();

  return (
    <div className="border-b border-slate-800 bg-slate-950">
      <div className="px-6 py-3 flex items-center gap-4">
        <div className="font-semibold text-slate-100">SIH26062</div>

        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/dashboard" active={loc.pathname === '/dashboard'}>
            Dashboard
          </NavLink>
          <NavLink to="/demo" active={loc.pathname === '/demo'}>
            Demo
          </NavLink>
          <NavLink to="/forecast" active={loc.pathname === '/forecast'}>
            Forecast
          </NavLink>
        </nav>

        <div className="ml-auto">
          <button
            className="text-xs rounded border border-slate-800 px-3 py-1 hover:bg-slate-900"
            onClick={() => {
              clearAuth();
              window.location.href = '/login';
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: any;
}) {
  return (
    <Link
      to={to}
      className={
        active ? 'text-indigo-300 font-medium' : 'text-slate-300 hover:text-slate-100'
      }
    >
      {children}
    </Link>
  );
}
