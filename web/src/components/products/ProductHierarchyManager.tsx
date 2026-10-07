import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Product, ProductModule, ProductSubmodule } from '../../types';
import {
  Package,
  Layers,
  Box,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ProductHierarchyManagerProps {
  product: Product;
  onClose: () => void;
  onHierarchyUpdated?: () => void;
}

export const ProductHierarchyManager: React.FC<ProductHierarchyManagerProps> = ({
  product,
  onClose,
  onHierarchyUpdated,
}) => {
  const [modules, setModules] = useState<ProductModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  // Sub-modal states
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ProductModule | null>(null);
  const [moduleForm, setModuleForm] = useState({ name: '', description: '', isActive: true });

  const [showSubmoduleModal, setShowSubmoduleModal] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [editingSubmodule, setEditingSubmodule] = useState<ProductSubmodule | null>(null);
  const [submoduleForm, setSubmoduleForm] = useState({ name: '', description: '', isActive: true });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchHierarchy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProductModules(product.id);
      const mods: ProductModule[] = res.modules || [];
      setModules(mods);

      // Auto-expand all modules initially
      setExpandedModuleIds(new Set(mods.map((m) => m.id)));
    } catch (err: any) {
      setError(err.message || 'Failed to load product hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, [product.id]);

  const toggleExpand = (modId: string) => {
    const next = new Set(expandedModuleIds);
    if (next.has(modId)) next.delete(modId);
    else next.add(modId);
    setExpandedModuleIds(next);
  };

  // --- Module Actions ---
  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleForm({ name: '', description: '', isActive: true });
    setFormError(null);
    setShowModuleModal(true);
  };

  const handleOpenEditModule = (mod: ProductModule) => {
    setEditingModule(mod);
    setModuleForm({
      name: mod.name,
      description: mod.description || '',
      isActive: mod.isActive !== false && (mod as any).is_active !== false,
    });
    setFormError(null);
    setShowModuleModal(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.name.trim()) {
      setFormError('Module name is required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingModule) {
        await api.updateProductModule(editingModule.id, {
          name: moduleForm.name.trim(),
          description: moduleForm.description.trim() || null,
          isActive: moduleForm.isActive,
        });
      } else {
        await api.createProductModule(product.id, {
          name: moduleForm.name.trim(),
          description: moduleForm.description.trim() || null,
          isActive: moduleForm.isActive,
        });
      }
      setShowModuleModal(false);
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save module');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleModuleStatus = async (mod: ProductModule) => {
    const currentActive = mod.isActive !== false && (mod as any).is_active !== false;
    try {
      await api.updateProductModule(mod.id, { isActive: !currentActive });
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      alert(`Failed to update module status: ${err.message}`);
    }
  };

  const handleDeleteModule = async (mod: ProductModule) => {
    if (!confirm(`Are you sure you want to delete module "${mod.name}" and all its submodules?`)) {
      return;
    }
    try {
      await api.deleteProductModule(mod.id);
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      alert(`Deletion blocked: ${err.message}`);
    }
  };

  // --- Submodule Actions ---
  const handleOpenAddSubmodule = (modId: string) => {
    setTargetModuleId(modId);
    setEditingSubmodule(null);
    setSubmoduleForm({ name: '', description: '', isActive: true });
    setFormError(null);
    setShowSubmoduleModal(true);
  };

  const handleOpenEditSubmodule = (sub: ProductSubmodule) => {
    setTargetModuleId(sub.moduleId);
    setEditingSubmodule(sub);
    setSubmoduleForm({
      name: sub.name,
      description: sub.description || '',
      isActive: sub.isActive !== false && (sub as any).is_active !== false,
    });
    setFormError(null);
    setShowSubmoduleModal(true);
  };

  const handleSaveSubmodule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submoduleForm.name.trim()) {
      setFormError('Submodule name is required.');
      return;
    }
    if (!targetModuleId) return;

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingSubmodule) {
        await api.updateProductSubmodule(editingSubmodule.id, {
          name: submoduleForm.name.trim(),
          description: submoduleForm.description.trim() || null,
          isActive: submoduleForm.isActive,
        });
      } else {
        await api.createProductSubmodule(targetModuleId, {
          name: submoduleForm.name.trim(),
          description: submoduleForm.description.trim() || null,
          isActive: submoduleForm.isActive,
        });
      }
      setShowSubmoduleModal(false);
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save submodule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubmoduleStatus = async (sub: ProductSubmodule) => {
    const currentActive = sub.isActive !== false && (sub as any).is_active !== false;
    try {
      await api.updateProductSubmodule(sub.id, { isActive: !currentActive });
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      alert(`Failed to update submodule status: ${err.message}`);
    }
  };

  const handleDeleteSubmodule = async (sub: ProductSubmodule) => {
    if (!confirm(`Are you sure you want to delete submodule "${sub.name}"?`)) {
      return;
    }
    try {
      await api.deleteProductSubmodule(sub.id);
      await fetchHierarchy();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err: any) {
      alert(`Deletion blocked: ${err.message}`);
    }
  };

  const totalSubmodules = modules.reduce((acc, m) => acc + (m.submodules?.length || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#0b3b60',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  {product.name}
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#0b3b60',
                    background: '#e0f2fe',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {product.code}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {product.category}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Product Hierarchy Management • {modules.length} Modules • {totalSubmodules} Submodules
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddModule}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> Add Module
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                color: '#64748b',
                borderRadius: 6,
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
              Loading hierarchy...
            </div>
          ) : modules.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px dashed #cbd5e1',
              }}
            >
              <Box size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>No Modules Defined</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, maxWidth: 440, margin: '4px auto 16px auto' }}>
                Break down <strong>{product.name}</strong> into functional modules and granular submodules for support ticketing and department specialization.
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleOpenAddModule}>
                <Plus size={14} /> Add First Module
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {modules.map((mod) => {
                const isExpanded = expandedModuleIds.has(mod.id);
                const isModActive = mod.isActive !== false && (mod as any).is_active !== false;
                const submodules = mod.submodules || [];

                return (
                  <div
                    key={mod.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      background: '#ffffff',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Module Row */}
                    <div
                      style={{
                        padding: '12px 16px',
                        background: isModActive ? '#f8fafc' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: isExpanded && submodules.length > 0 ? '1px solid #e2e8f0' : 'none',
                      }}
                      onClick={() => toggleExpand(mod.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(mod.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#0b3b60',
                            background: '#e0f2fe',
                            padding: '2px 6px',
                            borderRadius: 4,
                            letterSpacing: 0.5,
                          }}
                        >
                          MODULE
                        </span>

                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                            {mod.name}
                          </div>
                          {mod.description && (
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                              {mod.description}
                            </div>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: isModActive ? '#dcfce7' : '#f1f5f9',
                            color: isModActive ? '#15803d' : '#64748b',
                          }}
                        >
                          {isModActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleOpenAddSubmodule(mod.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Add Submodule"
                        >
                          <Plus size={12} /> Add Submodule
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleOpenEditModule(mod)}
                          title="Edit Module"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className={`btn btn-xs ${isModActive ? 'btn-outline' : 'btn-success'}`}
                          onClick={() => handleToggleModuleStatus(mod)}
                          title={isModActive ? 'Deactivate Module' : 'Activate Module'}
                        >
                          {isModActive ? <X size={12} color="#b91c1c" /> : <Check size={12} />}
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleDeleteModule(mod)}
                          title="Delete Module"
                          style={{ color: '#b91c1c' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Submodules Level */}
                    {isExpanded && (
                      <div style={{ padding: '8px 16px 8px 42px', background: '#ffffff' }}>
                        {submodules.length === 0 ? (
                          <div style={{ padding: '8px 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                            No submodules under this module yet.{' '}
                            <button
                              type="button"
                              onClick={() => handleOpenAddSubmodule(mod.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0284c7',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              + Add Submodule
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {submodules.map((sub) => {
                              const isSubActive = sub.isActive !== false && (sub as any).is_active !== false;

                              return (
                                <div
                                  key={sub.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    background: '#f8fafc',
                                    borderRadius: 6,
                                    border: '1px solid #f1f5f9',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: '#475569',
                                        background: '#e2e8f0',
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        letterSpacing: 0.4,
                                      }}
                                    >
                                      SUBMODULE
                                    </span>
                                    <div>
                                      <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                                        {sub.name}
                                      </span>
                                      {sub.description && (
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{sub.description}</div>
                                      )}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        background: isSubActive ? '#dcfce7' : '#f1f5f9',
                                        color: isSubActive ? '#15803d' : '#64748b',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {isSubActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                      className="btn btn-outline btn-xs"
                                      onClick={() => handleOpenEditSubmodule(sub)}
                                      title="Edit Submodule"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      className={`btn btn-xs ${isSubActive ? 'btn-outline' : 'btn-success'}`}
                                      onClick={() => handleToggleSubmoduleStatus(sub)}
                                      title={isSubActive ? 'Deactivate Submodule' : 'Activate Submodule'}
                                    >
                                      {isSubActive ? <X size={11} color="#b91c1c" /> : <Check size={11} />}
                                    </button>
                                    <button
                                      className="btn btn-outline btn-xs"
                                      onClick={() => handleDeleteSubmodule(sub)}
                                      title="Delete Submodule"
                                      style={{ color: '#b91c1c' }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Add / Edit Module Modal */}
      {showModuleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
        >
          <div style={{ background: 'white', borderRadius: 8, maxWidth: 440, width: '100%', padding: 20, boxShadow: '0 10px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {editingModule ? 'Edit Module' : 'Add New Module'}
              </h4>
              <button onClick={() => setShowModuleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveModule}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Module Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Payroll, Invoicing, Inventory"
                  value={moduleForm.name}
                  onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Functional scope of this module..."
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={moduleForm.isActive}
                    onChange={(e) => setModuleForm({ ...moduleForm, isActive: e.target.checked })}
                  />
                  <span>Active Module</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModuleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Saving...' : editingModule ? 'Save Changes' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Submodule Modal */}
      {showSubmoduleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
        >
          <div style={{ background: 'white', borderRadius: 8, maxWidth: 440, width: '100%', padding: 20, boxShadow: '0 10px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {editingSubmodule ? 'Edit Submodule' : 'Add New Submodule'}
              </h4>
              <button onClick={() => setShowSubmoduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSubmodule}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Submodule Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Salary Processing, Payslip, Daily Attendance"
                  value={submoduleForm.name}
                  onChange={(e) => setSubmoduleForm({ ...submoduleForm, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Scope of this submodule..."
                  value={submoduleForm.description}
                  onChange={(e) => setSubmoduleForm({ ...submoduleForm, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={submoduleForm.isActive}
                    onChange={(e) => setSubmoduleForm({ ...submoduleForm, isActive: e.target.checked })}
                  />
                  <span>Active Submodule</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSubmoduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Saving...' : editingSubmodule ? 'Save Changes' : 'Create Submodule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
