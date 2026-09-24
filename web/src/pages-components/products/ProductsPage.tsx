'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Filter,
  RefreshCw,
  Layers,
  Check,
  X,
  AlertCircle,
  Trash2,
  Eye,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  isActive: boolean;
  subscriptions_count: number;
  implementations_count: number;
  created_at: string;
}

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Enterprise Software',
    description: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    'Enterprise Software',
    'Cloud POS',
    'FinTech',
    'Cybersecurity',
    'AI & Automation',
    'Hardware & IoT',
    'Custom Solutions',
  ];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (statusFilter !== 'ALL') params.isActive = statusFilter === 'ACTIVE';

      const [res, statsRes] = await Promise.all([
        api.getProducts(params),
        api.getProductStats().catch(() => ({ stats: null })),
      ]);

      setProducts(res.data || []);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) return;
    setSubmitting(true);
    try {
      await api.createProduct(formData);
      setShowAddModal(false);
      setFormData({ code: '', name: '', category: 'Enterprise Software', description: '', isActive: true });
      fetchData();
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      await api.updateProduct(selectedProduct.id, formData);
      setShowEditModal(false);
      setSelectedProduct(null);
      fetchData();
    } catch (err: any) {
      alert(`Error updating product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = !product.isActive;
    const confirmMsg = newStatus
      ? `Activate product "${product.name}"?`
      : `Deactivate product "${product.name}"? Active customer subscriptions and implementations will remain preserved in historical records.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.toggleProductStatus(product.id, newStatus);
      fetchData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (product.subscriptions_count > 0 || product.implementations_count > 0) {
      alert(
        `Cannot delete product "${product.name}" because it is linked to ${product.subscriptions_count} subscription(s) and ${product.implementations_count} implementation(s). Please deactivate it instead.`,
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete product "${product.name}" (${product.code})? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteProduct(product.id);
      fetchData();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      category: product.category,
      description: product.description || '',
      isActive: product.isActive,
    });
    setShowEditModal(true);
  };

  const openView = (product: Product) => {
    setSelectedProduct(product);
    setShowViewModal(true);
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package className="text-primary" size={24} />
            Product Master
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Central catalog of software suites, enterprise platforms, and billable service modules
          </p>
        </div>
        {isAdminOrManager && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormData({ code: '', name: '', category: 'Enterprise Software', description: '', isActive: true });
              setShowAddModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            Add New Product
          </button>
        )}
      </div>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>TOTAL PRODUCTS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0b3b60', marginTop: 4 }}>{stats.total}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>ACTIVE PRODUCTS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{stats.active}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>INACTIVE PRODUCTS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#64748b', marginTop: 4 }}>{stats.inactive}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>PRODUCT CATEGORIES</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{stats.categories?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by code, name, category, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="#64748b" />
            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <button type="submit" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Search
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSearch('');
              setCategoryFilter('ALL');
              setStatusFilter('ALL');
            }}
            title="Reset Filters"
          >
            <RefreshCw size={14} />
          </button>
        </form>
      </div>

      {/* Product Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            Loading product directory...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#b91c1c' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {error}
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Package size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#334155' }}>No Products Found</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Try adjusting your search filters or click "Add New Product" to create your first catalog item.
            </div>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>PRODUCT CODE</th>
                <th style={{ padding: '12px 16px' }}>PRODUCT NAME</th>
                <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                <th style={{ padding: '12px 16px' }}>SUBSCRIPTIONS</th>
                <th style={{ padding: '12px 16px' }}>IMPLEMENTATIONS</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>CREATED</th>
                {isAdminOrManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0b3b60' }}>
                    <code>{p.code}</code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                    {p.description && (
                      <div style={{ fontSize: 11, color: '#64748b', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                      {p.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    {p.subscriptions_count} active
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    {p.implementations_count} projects
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="badge"
                      style={{
                        background: p.isActive ? '#dcfce7' : '#f1f5f9',
                        color: p.isActive ? '#15803d' : '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {formatDate(p.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => openView(p)}
                        title="View Product Details"
                      >
                        <Eye size={13} />
                      </button>
                      {isAdminOrManager && (
                        <>
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => openEdit(p)}
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className={`btn btn-xs ${p.isActive ? 'btn-outline' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(p)}
                            title={p.isActive ? 'Deactivate Product' : 'Activate Product'}
                          >
                            {p.isActive ? <X size={13} color="#b91c1c" /> : <Check size={13} />}
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleDeleteProduct(p)}
                          title="Delete Product (Admin Only)"
                          style={{ color: '#b91c1c' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Product Details Modal */}
      {showViewModal && selectedProduct && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                Product Details • <code>{selectedProduct.code}</code>
              </h3>
              <button onClick={() => setShowViewModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>PRODUCT NAME</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{selectedProduct.name}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CATEGORY</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 2 }}>{selectedProduct.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>STATUS</div>
                  <div style={{ marginTop: 2 }}>
                    <span
                      className="badge"
                      style={{
                        background: selectedProduct.isActive ? '#dcfce7' : '#f1f5f9',
                        color: selectedProduct.isActive ? '#15803d' : '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      {selectedProduct.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>DESCRIPTION & CAPABILITIES</div>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 2, background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', minHeight: 60 }}>
                  {selectedProduct.description || 'No additional description provided.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ACTIVE SUBSCRIPTIONS</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0b3b60', marginTop: 2 }}>{selectedProduct.subscriptions_count}</div>
                </div>
                <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>IMPLEMENTATIONS</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>{selectedProduct.implementations_count}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Created on {formatDate(selectedProduct.created_at)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Add New Master Product</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Code (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. KT-ERP-PRO (Leave blank to auto-generate)"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. KANVTECH Unified PayFlow"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Category *</label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Description & Capabilities</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Summary of product features, target architecture, or SLA terms..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="prodActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="prodActive" style={{ fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  Active and available for customer subscription & deployment
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Edit Product • {selectedProduct.code}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Category *</label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="prodActiveEdit"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="prodActiveEdit" style={{ fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  Active status
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
