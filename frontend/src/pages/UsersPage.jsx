import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  UserCheck,
  UserX,
  Edit2,
  Lock,
  X,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [isActive, setIsActive] = useState(true);

  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to fetch user accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('operator');
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setIsActive(u.is_active);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: name.trim(),
          role,
          is_active: isActive,
          ...(password ? { password } : {}),
        });
      } else {
        if (!password || password.length < 8) {
          setError('Password must be at least 8 characters long.');
          return;
        }
        await api.createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Operation failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Administration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage system access credentials, role authorizations, and safety officer accounts.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create User Account
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, index) => (
                <tr key={u.id || u._id || `user-${index}`} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.is_active ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <UserCheck className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                        <UserX className="w-3.5 h-3.5" />
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3 inline mr-1" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-base">
                {editingUser ? 'Edit User Account' : 'Create User Account'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Alex Vance"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.vance@maskguard.ai"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  <option value="operator">Operator (Monitor cameras & alerts)</option>
                  <option value="admin">Administrator (Full control)</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-slate-300"
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {editingUser ? 'Save Updates' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
