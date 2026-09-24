import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { login, register } from '../api/auth';
import { clearAuth, saveAuth } from '../state/auth';
import type { Role } from '../state/auth';

export default function LoginPage() {
  const nav = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('ADMIN');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: any) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      clearAuth();
      const result =
        mode === 'login'
          ? await login({ username, password })
          : await register({ username, password, role });

      saveAuth(result);
      nav('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error ? String((err as any).response.data.error) : (err as any)?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-semibold">SIH26062</h1>
        <p className="text-sm text-slate-400 mt-1">Operational logistics demo</p>

        <div className="mt-4 flex gap-2">
          <button
            className={`px-3 py-1 rounded ${mode === 'login' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-100'}`}
            type="button"
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={`px-3 py-1 rounded ${mode === 'register' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-100'}`}
            type="button"
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <div className="text-sm text-slate-300 mb-1">Username</div>
            <input
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2"
              value={username}
              onChange={(e: any) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <div className="text-sm text-slate-300 mb-1">Password</div>
            <input
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2"
              type="password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              required
            />
          </label>

          {mode === 'register' ? (
            <label className="block">
              <div className="text-sm text-slate-300 mb-1">Role</div>
              <select
                className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2"
                value={role}
                onChange={(e: any) => setRole(e.target.value as Role)}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="PLANNER">PLANNER</option>
                <option value="LOGISTICS">LOGISTICS</option>
                <option value="MEDICAL">MEDICAL</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>
            </label>
          ) : null}

          {error ? (
            <div className="rounded border border-red-700 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            disabled={busy}
            className="w-full rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-3 py-2 font-medium"
          >
            {busy ? 'Working…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
