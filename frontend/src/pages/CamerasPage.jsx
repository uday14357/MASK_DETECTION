import React, { useState, useEffect } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Video,
  Layers,
  X,
  Search,
  Lock,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [formError, setFormError] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [cameraType, setCameraType] = useState('webcam');
  const [rtspUrl, setRtspUrl] = useState('');
  const [statusVal, setStatusVal] = useState('active');

  const { isAdmin } = useAuth();

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const data = await api.getCameras();
      setCameras(data || []);
    } catch (err) {
      console.error('Failed to load cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const openAddModal = () => {
    setEditingCamera(null);
    setName('');
    setLocation('');
    setCameraType('webcam');
    setRtspUrl('');
    setStatusVal('active');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (cam) => {
    setEditingCamera(cam);
    setName(cam.name);
    setLocation(cam.location);
    setCameraType(cam.camera_type);
    setRtspUrl('');
    setStatusVal(cam.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !location.trim()) {
      setFormError('Camera name and location are required.');
      return;
    }

    try {
      if (editingCamera) {
        await api.updateCamera(editingCamera._id, {
          name: name.trim(),
          location: location.trim(),
          camera_type: cameraType,
          status: statusVal,
          ...(rtspUrl ? { rtsp_url: rtspUrl } : {})
        });
      } else {
        await api.createCamera({
          name: name.trim(),
          location: location.trim(),
          camera_type: cameraType,
          status: statusVal,
          ...(rtspUrl ? { rtsp_url: rtspUrl } : {})
        });
      }
      setModalOpen(false);
      fetchCameras();
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await api.deleteCamera(deleteCandidate._id);
      setDeleteCandidate(null);
      fetchCameras();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredCameras = cameras.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Camera Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register and configure monitoring video endpoints and access permissions.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Camera
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 shadow-2xs"
          />
        </div>
        <button
          onClick={fetchCameras}
          className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Camera Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCameras.map((cam) => (
          <div
            key={cam._id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{cam.name}</h3>
                    <p className="text-xs text-slate-500">{cam.location}</p>
                  </div>
                </div>

                {cam.status === 'active' ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
                    Requires streaming configuration
                  </span>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Type:</span>
                  <span className="font-semibold text-slate-700 uppercase text-[11px]">
                    {cam.camera_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stream Credentials:</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                    <Lock className="w-3 h-3 text-slate-400" />
                    {cam.has_stream_credentials ? 'Secured' : 'None required'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Seen:</span>
                  <span className="text-slate-600 text-[11px]">
                    {cam.last_seen_at ? new Date(cam.last_seen_at).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditModal(cam)}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteCandidate(cam)}
                  className="px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredCameras.length === 0 && !loading && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
          No cameras found matching your criteria.
        </div>
      )}

      {/* Add / Edit Camera Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-base">
                {editingCamera ? 'Edit Camera Configuration' : 'Register New Camera'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Camera Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ICU Entrance Camera"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Department
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. 2nd Floor Lobby Ward A"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Camera Type
                </label>
                <select
                  value={cameraType}
                  onChange={(e) => setCameraType(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  <option value="webcam">Browser / Laptop Webcam</option>
                  <option value="image_upload">Image Upload Station</option>
                  <option value="ip_camera">CCTV / IP Camera (RTSP)</option>
                </select>
              </div>

              {cameraType === 'ip_camera' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Protected RTSP Stream URL
                  </label>
                  <input
                    type="password"
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    placeholder="rtsp://admin:secret@192.168.1.10:554/live"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 font-mono"
                  />
                  <p className="text-[11px] text-amber-700 mt-1">
                    *Note: RTSP streaming requires an active WebRTC/HLS media gateway. Credentials will be securely stored on the server and never exposed in API responses.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  <option value="active">Active Monitoring</option>
                  <option value="inactive">Disabled / Maintenance</option>
                </select>
              </div>

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
                  {editingCamera ? 'Save Changes' : 'Create Camera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h2 className="font-bold text-slate-900 text-base mb-2">Confirm Camera Removal</h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to remove <span className="font-bold text-slate-800">{deleteCandidate.name}</span>?
              <br /><br />
              <strong>Note:</strong> All existing historical event records and compliance logs linked to this camera will be preserved in the audit database.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Delete Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
