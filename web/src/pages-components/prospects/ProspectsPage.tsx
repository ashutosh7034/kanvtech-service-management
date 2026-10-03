import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { Search, Plus, Building, User, Phone, Mail, ArrowRight, X, Briefcase } from 'lucide-react';
import { formatDateTime } from '../../utils/date';

export const ProspectsPage: React.FC = () => {
  const { showToast } = useNotifications();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showCreate, setShowCreate] = useState(false);
  const [showConvert, setShowConvert] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    enquiry: '',
    source: 'Website'
  });

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    loadProspects();
    loadProducts();
  }, [search]);

  const loadProspects = async () => {
    setLoading(true);
    try {
      const res = await api.getProspects({ search });
      setProspects(res.data);
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.data);
    } catch (err: any) {
      console.error('Failed to load products');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProspect(formData);
      showToast('Prospect created successfully', 'success');
      setShowCreate(false);
      setFormData({ companyName: '', contactPerson: '', phone: '', email: '', enquiry: '', source: 'Website' });
      loadProspects();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConvert) return;
    if (selectedProductIds.length === 0) {
      showToast('Please select at least one product for the customer.', 'danger');
      return;
    }

    try {
      const res = await api.convertProspect(showConvert.id, { productIds: selectedProductIds });
      showToast(`Converted to Customer Account: ${res.companyId}`, 'success');
      setShowConvert(null);
      setSelectedProductIds([]);
      loadProspects();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Prospects & Leads</h1>
          <p style={{ color: '#64748b' }}>Manage sales inquiries and convert prospects to customers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Prospect
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search prospects..."
            style={{ paddingLeft: 36 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : prospects.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No prospects found.</div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 12 }}>ID</th>
                <th style={{ padding: 12 }}>Organization</th>
                <th style={{ padding: 12 }}>Contact</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Created</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 12, fontWeight: 600, color: '#0369a1' }}>{p.id}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{p.company_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.enquiry}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div>{p.contact_person}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.phone}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: p.status === 'CONVERTED' ? '#dcfce7' : '#fef9c3',
                      color: p.status === 'CONVERTED' ? '#166534' : '#854d0e'
                    }}>
                      {p.status}
                    </span>
                    {p.converted_to_company_id && (
                      <div style={{ fontSize: 11, color: '#166534', marginTop: 4 }}>
                        → {p.converted_to_company_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: '#64748b' }}>{formatDateTime(p.created_at)}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    {p.status !== 'CONVERTED' && (
                      <button className="btn btn-success btn-sm" onClick={() => setShowConvert(p)}>
                        <ArrowRight size={14} /> Convert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 500, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Add New Prospect</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowCreate(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Company / Organization Name</label>
                <input type="text" className="form-control" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="form-control" required value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="form-control" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Email Address</label>
                <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Enquiry Details</label>
                <textarea className="form-control" required rows={3} value={formData.enquiry} onChange={e => setFormData({...formData, enquiry: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>Create Prospect</button>
            </form>
          </div>
        </div>
      )}

      {showConvert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 500, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#166534' }}>Convert to Customer</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowConvert(null)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#475569', marginBottom: 16, fontSize: 14 }}>
              Converting <strong>{showConvert.company_name}</strong> will create a live Company account (CMP-XXXX) and Customer login.
            </p>
            <form onSubmit={handleConvert}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Select Initial Entitled Products</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {products.map(prod => (
                    <label key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedProductIds.includes(prod.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProductIds([...selectedProductIds, prod.id]);
                          else setSelectedProductIds(selectedProductIds.filter(id => id !== prod.id));
                        }}
                      />
                      <span>{prod.name} ({prod.code})</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-success" style={{ width: '100%' }}>Complete Conversion</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
