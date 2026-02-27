import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Allow configuring API base URL via environment variable for production
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// Trigger server-side Drive upload (fire-and-forget). Server will return an error
// if not authorized — that's fine, we simply log it for visibility.
function triggerDriveUpload() {
  axios.post('/api/drive/upload').then(resp => {
    console.log('Drive upload triggered:', resp.data);
  }).catch(err => {
    console.warn('Drive upload failed or not authorized:', err.response?.data || err.message);
  });
}

const INSURANCE_TYPES = {
  'Motor - Vehicle': ['Comprehensive', 'TPO (Third Party Only)'],
  'Commercial Vehicle': ['Commercial Van', 'Commercial Truck', 'Commercial Vehicle'],
  'Private Cars': ['Private Sedan', 'Private SUV', 'Private Hatchback'],
  'PSV/Uber/Taxi': ['Uber', 'Taxi', 'Matatu', 'PSV', 'PSV Bus'],
  'Motorcycle': ['Private Motorcycle', 'Commercial Motorcycle'],
  'TukTuk': ['TukTuk'],
  'Non-Motor - Property': ['Fire', 'Theft', 'Burglary', 'Property Coverage'],
  'Personal Accident': ['Domestic PA', 'Student PA', 'Personal Accident']
};

// Login Component
function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/login', { username, password });
      if (response.data.success) {
        localStorage.setItem('authToken', response.data.token);
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🔐 ABIJAY Admin</h1>
        <p className="login-subtitle">Insurance Client Management System</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Insurance Expiry Dashboard Component
function InsuranceExpiryDashboard() {
  const [expiryData, setExpiryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, expiring_soon

  useEffect(() => {
    fetchExpiryData();
    // Refresh every hour to update days remaining
    const interval = setInterval(fetchExpiryData, 3600000);
    return () => clearInterval(interval);
  }, []);

  const fetchExpiryData = async () => {
    try {
      const response = await axios.get('/api/insurance-expiry');
      setExpiryData(response.data);
    } catch (error) {
      console.error('Error fetching expiry data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    switch(filter) {
      case 'expiring_soon':
        return expiryData.filter(item => item.isExpiringSoon && !item.isExpired).sort((a, b) => a.daysRemaining - b.daysRemaining);
      default:
        return expiryData.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }
  };

  const getStatusColor = (item) => {
    if (item.isExpired) {
      return { bg: '#f8d7da', text: '#721c24', status: '❌ EXPIRED' };
      } else if (item.isExpiringSoon) {
        return { bg: '#fdecea', text: '#e74c3c', status: '⚠️ EXPIRING SOON' };
    } else {
      return { bg: '#d4edda', text: '#155724', status: '✅ VALID' };
    }
  };

  const filteredData = getFilteredData();

  return (
    <div>
      <div className="dashboard-section">
        <div className="stats-boxes">
          <div className="stat-box">
            <div className="stat-number">{expiryData.filter(d => d.isExpired).length}</div>
            <div className="stat-label">Expired</div>
          </div>
          <div className="stat-box warning">
            <div className="stat-number">{expiryData.filter(d => d.isExpiringSoon && !d.isExpired).length}</div>
            <div className="stat-label">Expiring Soon</div>
          </div>
          <div className="stat-box info">
            <div className="stat-number">{expiryData.length}</div>
            <div className="stat-label">Total Clients</div>
          </div>
        </div>

        <div className="filter-section">
          <h3>Filter by Status:</h3>
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({expiryData.length})
            </button>
            <button 
              className={`filter-btn ${filter === 'expiring_soon' ? 'active' : ''}`}
              onClick={() => setFilter('expiring_soon')}
            >
              Expiring Soon ({expiryData.filter(d => d.isExpiringSoon && !d.isExpired).length})
            </button>
          </div>
        </div>
      </div>

      <div className="expiry-list">
        {loading ? (
          <div className="loading">Loading insurance data...</div>
        ) : filteredData.length === 0 ? (
          <div className="empty-state">No clients found for this filter.</div>
        ) : (
          <div className="expiry-table">
            <div className="expiry-header">
              <div className="expiry-cell">Name</div>
              <div className="expiry-cell">Vehicle</div>
              <div className="expiry-cell">Company</div>
              <div className="expiry-cell">Category</div>
              <div className="expiry-cell">Type</div>
              <div className="expiry-cell">Expiry Date</div>
              <div className="expiry-cell">Days Remaining</div>
              <div className="expiry-cell">Status</div>
            </div>
            {filteredData.map((item) => {
              const statusInfo = getStatusColor(item);
              return (
                <div key={item.id} className={`expiry-row ${item.isExpired ? 'expired' : ''}`}> 
                  <div className="expiry-cell">{item.name}</div>
                  <div className="expiry-cell">{item.vehicleNumberPlate || '—'}</div>
                  <div className="expiry-cell">{item.company || '—'}</div>
                  <div className="expiry-cell">{item.insuranceCategory || '—'}</div>
                  <div className="expiry-cell">{item.insuranceType || '—'}</div>
                  <div className="expiry-cell">{item.expiryDate || '—'}</div>
                  <div className="expiry-cell">{item.isExpired ? `${Math.abs(item.daysRemaining)} days overdue` : `${item.daysRemaining} days`}</div>
                  <div className="expiry-cell" style={{color: statusInfo.text}}>{statusInfo.status}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Client Management Component
function ClientManagementPage() {
  const [clients, setClients] = useState([]);
  const clientsListRef = React.useRef(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    customerIdNo: '',
    vehicleNumberPlate: '',
    insuranceCategory: '',
    insuranceType: '',
    businessType: '',
    startDate: '',
    expiryDate: '',
    company: '',
    premium: '',
    premiumPaid: ''
  });
  const [newRecordForm, setNewRecordForm] = useState({
    claimNumber: '',
    claimAmount: '',
    claimDate: new Date().toISOString().split('T')[0],
    status: 'Pending',
    recordType: '',
    description: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  // --- Claims page: helper to select top match on Enter in claims search ---
  const handleClaimsSearchEnter = (qInput, localFetchClientDetail) => {
    const q = qInput.trim().toLowerCase();
    const filtered = clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return (q === '' || name.includes(q) || phone.includes(q));
    });
    if (filtered.length > 0) {
      const first = filtered[0];
      setSearchQuery(isNumericQuery(q) ? (first.phone || first.name) : (first.name));
      localFetchClientDetail(first.id);
    }
  };

  useEffect(() => {
    // whenever search query changes, scroll clients list to top so top match is visible
    if (clientsListRef.current) clientsListRef.current.scrollTop = 0;
  }, [searchQuery]);

  const fetchClients = async () => {
    try {
      const response = await axios.get('/api/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  // helper to determine whether a query is numeric (phone-like)
  const isNumericQuery = (q) => /^\d+$/.test(q.trim());

  const handleSearchEnter = () => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return (q === '' || name.includes(q) || phone.includes(q));
    });
    if (filtered.length > 0) {
      const first = filtered[0];
      setSearchQuery(isNumericQuery(q) ? (first.phone || first.name) : (first.name));
      fetchClientDetail(first.id);
    }
  };

  const fetchClientDetail = async (clientId) => {
    try {
      const response = await axios.get(`/api/clients/${clientId}?aggregate=true`);
      setSelectedClient(response.data);
      setEditingClient(null);
    } catch (error) {
      console.error('Error fetching client detail:', error);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientForm.name.trim()) {
      alert('Client name is required');
      return;
    }
    // sanitize phone: strip any non-digit characters then validate (accepts formatted input)
    const phoneDigits = (newClientForm.phone || '').toString().replace(/\D/g, '').trim();
    if (!phoneDigits || phoneDigits.length !== 10) {
      alert('Phone number is required and must be 10 digits');
      return;
    }
    try {
      const payload = { ...newClientForm, phone: phoneDigits };
      const response = await axios.post('/api/clients', payload);
      setNewClientForm({ name: '', email: '', phone: '', customerIdNo: '', vehicleNumberPlate: '', insuranceCategory: '', insuranceType: '', businessType: '', startDate: '', expiryDate: '', company: '', premium: '', premiumPaid: '' });
      fetchClients();
      setSelectedClient(response.data);
      setSearchQuery(response.data.name || response.data.phone || '');
      triggerDriveUpload();
    } catch (error) {
      console.error('Error adding client:', error);
      alert('Error adding client');
    }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!editingClient.name.trim()) {
      alert('Client name is required');
      return;
    }
    // sanitize phone on update: strip non-digits and validate
    const phoneDigits = String(editingClient.phone || '').replace(/\D/g, '').trim();
    if (!phoneDigits || phoneDigits.length !== 10) {
      alert('Phone number is required and must be 10 digits');
      return;
    }
    try {
      const payload = { ...editingClient, phone: phoneDigits };
      await axios.put(`/api/clients/${editingClient.id}`, payload);
      fetchClients();
      fetchClientDetail(editingClient.id);
      triggerDriveUpload();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client');
    }
  };

  const handleDeleteClient = async () => {
    if (window.confirm(`Delete client ${selectedClient.name}? This will also delete all associated claims.`)) {
      try {
        await axios.delete(`/api/clients/${selectedClient.id}`);
        setSelectedClient(null);
        fetchClients();
        triggerDriveUpload();
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client');
      }
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!newRecordForm.claimNumber.trim()) {
      alert('Claim number is required');
      return;
    }
    if (!newRecordForm.recordType) {
      alert('Please select record type (Annual / Renewal / Monthly)');
      return;
    }
    try {
      await axios.post(`/api/clients/${selectedClient.id}/records`, newRecordForm);
      setNewRecordForm({ claimNumber: '', claimAmount: '', claimDate: new Date().toISOString().split('T')[0], status: 'Pending', description: '' });
      fetchClientDetail(selectedClient.id);
      triggerDriveUpload();
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Error adding record');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Delete this claim?')) {
      try {
        await axios.delete(`/api/records/${recordId}`);
        fetchClientDetail(selectedClient.id);
        triggerDriveUpload();
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error deleting record');
      }
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Approved':
        return { bg: '#d4edda', text: '#155724' };
      case 'Rejected':
        return { bg: '#f8d7da', text: '#721c24' };
      case 'In Review':
        return { bg: '#fff3cd', text: '#856404' };
      default:
        return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  return (
    <div>
      <div className="container">
        <div className="main-content">
          <div className="clients-list">
            <h2>Clients</h2>
            <div style={{marginBottom: '8px'}}>
              <input
                type="text"
                placeholder="Search client by name or phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchEnter(); } }}
                style={{width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
            </div>

            <div className="add-client-section">
              <h3>Add New Client</h3>
              <form onSubmit={handleAddClient}>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Client Name *"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Vehicle Number Plate"
                    value={newClientForm.vehicleNumberPlate}
                    onChange={(e) => setNewClientForm({ ...newClientForm, vehicleNumberPlate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <select 
                    value={newClientForm.insuranceCategory}
                    onChange={(e) => setNewClientForm({ ...newClientForm, insuranceCategory: e.target.value, insuranceType: '' })}
                    style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                  >
                    <option value="">Select Insurance Category *</option>
                    {Object.keys(INSURANCE_TYPES).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                {newClientForm.insuranceCategory && (
                  <div className="form-group">
                    <select 
                      value={newClientForm.insuranceType}
                      onChange={(e) => setNewClientForm({ ...newClientForm, insuranceType: e.target.value })}
                      style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                    >
                      <option value="">Select Insurance Type *</option>
                      {INSURANCE_TYPES[newClientForm.insuranceCategory].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <select 
                    value={newClientForm.businessType}
                    onChange={(e) => setNewClientForm({ ...newClientForm, businessType: e.target.value })}
                    style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                  >
                    <option value="">Select Business Type</option>
                    <option value="New Business">New Business</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Extension">Extension</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Email"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Customer ID No"
                    value={newClientForm.customerIdNo}
                    onChange={(e) => setNewClientForm({ ...newClientForm, customerIdNo: e.target.value })}
                  />
                  <input list="companies" type="text" placeholder="Company (e.g. BRITAM, TRIDENT, CIC)" value={newClientForm.company} onChange={(e) => setNewClientForm({ ...newClientForm, company: e.target.value })} />
                  <datalist id="companies">
                    <option value="BRITAM" />
                    <option value="TRIDENT" />
                    <option value="CIC" />
                  </datalist>
                  <input type="number" step="0.01" placeholder="Premium (Ksh)" value={newClientForm.premium} onChange={(e) => setNewClientForm({ ...newClientForm, premium: e.target.value })} />
                  <input type="number" step="0.01" placeholder="Amount Paid (Ksh)" value={newClientForm.premiumPaid} onChange={(e) => setNewClientForm({ ...newClientForm, premiumPaid: e.target.value })} />
                  <input type="text" placeholder="Balance (Ksh)" value={(parseFloat(newClientForm.premium || 0) - parseFloat(newClientForm.premiumPaid || 0)).toFixed(2)} readOnly />
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={newClientForm.startDate}
                    onChange={(e) => setNewClientForm({ ...newClientForm, startDate: e.target.value })}
                  />
                  <input
                    type="date"
                    placeholder="Expiry Date"
                    value={newClientForm.expiryDate}
                    onChange={(e) => setNewClientForm({ ...newClientForm, expiryDate: e.target.value })}
                  />
                </div>
                <button type="submit" className="success">Add Client</button>
              </form>
            </div>

            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = clients.filter(c => {
                const name = (c.name || '').toLowerCase();
                const phone = String(c.phone || '').toLowerCase();
                return (q === '' || name.includes(q) || phone.includes(q));
              });
              if (filtered.length === 0) return (<div className="empty-state">No clients found.</div>);
              // score and sort matches so best matches appear first: startsWith > includes > others
              if (q) {
                filtered.sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aScore = aName.startsWith(q) ? 2 : (aName.includes(q) ? 1 : 0);
                  const bScore = bName.startsWith(q) ? 2 : (bName.includes(q) ? 1 : 0);
                  if (aScore !== bScore) return bScore - aScore;
                  return aName.localeCompare(bName);
                });
              } else {
                filtered.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
              }

              return (
                <div className="clients-table" ref={clientsListRef}>
                  <div className="clients-header">
                    <div className="clients-cell">Name</div>
                    <div className="clients-cell">ID</div>
                    <div className="clients-cell">Phone</div>
                    <div className="clients-cell">Vehicle</div>
                    <div className="clients-cell">Company</div>
                    <div className="clients-cell">Expiry</div>
                  </div>
                  {filtered.map((client) => (
                    <div
                      key={client.id}
                      className={`clients-row ${selectedClient?.id === client.id ? 'active' : ''}`}
                      onClick={() => { setSearchQuery(isNumericQuery(q) ? (client.phone || client.name) : (client.name)); fetchClientDetail(client.id); }}
                    >
                      <div className="clients-cell">{client.name}</div>
                      <div className="clients-cell">{client.id}</div>
                      <div className="clients-cell">{client.phone || '—'}</div>
                      <div className="clients-cell">{client.vehicleNumberPlate || '—'}</div>
                      <div className="clients-cell">{client.company || '—'}</div>
                      <div className="clients-cell">{client.expiryDate || '—'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="client-detail">
            {selectedClient ? (
              <>
                <div>
                  {editingClient ? (
                    <form onSubmit={handleUpdateClient}>
                      <div className="form-group">
                        <label>Name *</label>
                        <input
                          type="text"
                          value={editingClient.name}
                          onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                        />
                      </div>
                          <div className="form-group">
                            <label>Vehicle Number Plate</label>
                            <input
                              type="text"
                              value={editingClient.vehicleNumberPlate || ''}
                              onChange={(e) => setEditingClient({ ...editingClient, vehicleNumberPlate: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Company</label>
                            <input list="companies" type="text" value={editingClient.company || ''} onChange={(e) => setEditingClient({ ...editingClient, company: e.target.value })} />
                            <datalist id="companies">
                              <option value="BRITAM" />
                              <option value="TRIDENT" />
                              <option value="CIC" />
                            </datalist>
                          </div>
                          <div className="form-group">
                            <label>Premium Paid (Ksh)</label>
                            <input type="number" step="0.01" value={editingClient.premium || ''} onChange={(e) => setEditingClient({ ...editingClient, premium: e.target.value })} />
                            <input type="number" step="0.01" value={editingClient.premiumPaid || ''} onChange={(e) => setEditingClient({ ...editingClient, premiumPaid: e.target.value })} />
                            <input type="text" value={(parseFloat(editingClient.premium || 0) - parseFloat(editingClient.premiumPaid || 0)).toFixed(2)} readOnly />
                          </div>
                      <div className="form-group">
                        <label>Insurance Category</label>
                        <select 
                          value={editingClient.insuranceCategory || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, insuranceCategory: e.target.value, insuranceType: '' })}
                          style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        >
                          <option value="">Select Category</option>
                          {Object.keys(INSURANCE_TYPES).map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      {editingClient.insuranceCategory && (
                        <div className="form-group">
                          <label>Insurance Type</label>
                          <select 
                            value={editingClient.insuranceType || ''}
                            onChange={(e) => setEditingClient({ ...editingClient, insuranceType: e.target.value })}
                            style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          >
                            <option value="">Select Type</option>
                            {INSURANCE_TYPES[editingClient.insuranceCategory].map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="form-group">
                        <label>Business Type</label>
                        <select 
                          value={editingClient.businessType || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, businessType: e.target.value })}
                          style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        >
                          <option value="">Select Business Type</option>
                          <option value="New Business">New Business</option>
                          <option value="Renewal">Renewal</option>
                          <option value="Extension">Extension</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={editingClient.email || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          value={editingClient.phone || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Customer ID No</label>
                        <input
                          type="text"
                          value={editingClient.customerIdNo || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, customerIdNo: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={editingClient.startDate || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, startDate: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Expiry Date</label>
                        <input
                          type="date"
                          value={editingClient.expiryDate || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, expiryDate: e.target.value })}
                        />
                      </div>
                      <div className="button-group">
                        <button type="submit">Save Changes</button>
                        <button type="button" onClick={() => setEditingClient(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h2>{selectedClient.name}</h2>
                      <div className="client-info">
                        {selectedClient.vehicleNumberPlate && (
                          <div className="info-row">
                            <span className="info-label">🚗 Vehicle Number Plate:</span>
                            <span className="info-value">{selectedClient.vehicleNumberPlate}</span>
                          </div>
                        )}
                        {selectedClient.businessType && (
                          <div className="info-row">
                            <span className="info-label">📝 Business Type:</span>
                            <span className="info-value">{selectedClient.businessType}</span>
                          </div>
                        )}
                        {selectedClient.company && (
                          <div className="info-row">
                            <span className="info-label">🏢 Company:</span>
                            <span className="info-value">{selectedClient.company}</span>
                          </div>
                        )}
                        {(selectedClient.premium != null || selectedClient.premiumPaid != null) && (
                          <div className="info-row">
                            <span className="info-label">💰 Premium:</span>
                            <span className="info-value">{selectedClient.premium || 0} (Paid: {selectedClient.premiumPaid || 0}) — Balance: {( (parseFloat(selectedClient.premium || 0) - parseFloat(selectedClient.premiumPaid || 0)).toFixed(2) )}</span>
                          </div>
                        )}
                        {selectedClient.insuranceCategory && (
                          <div className="info-row">
                            <span className="info-label">📂 Category:</span>
                            <span className="info-value">{selectedClient.insuranceCategory}</span>
                          </div>
                        )}
                        {selectedClient.insuranceType && (
                          <div className="info-row">
                            <span className="info-label">🛡️ Type:</span>
                            <span className="info-value">{selectedClient.insuranceType}</span>
                          </div>
                        )}
                        {selectedClient.email && (
                          <div className="info-row">
                            <span className="info-label">📧 Email:</span>
                            <span className="info-value">{selectedClient.email}</span>
                          </div>
                        )}
                        {selectedClient.phone && (
                          <div className="info-row">
                            <span className="info-label">📱 Phone:</span>
                            <span className="info-value">{selectedClient.phone}</span>
                          </div>
                        )}
                        {selectedClient.customerIdNo && (
                          <div className="info-row">
                            <span className="info-label">🆔 Customer ID:</span>
                            <span className="info-value">{selectedClient.customerIdNo}</span>
                          </div>
                        )}
                        {selectedClient.startDate && (
                          <div className="info-row">
                            <span className="info-label">📅 Start Date:</span>
                            <span className="info-value">{selectedClient.startDate}</span>
                          </div>
                        )}
                        {selectedClient.expiryDate && (
                          <div className="info-row">
                            <span className="info-label">⏰ Expiry Date:</span>
                            <span className="info-value">{selectedClient.expiryDate}</span>
                          </div>
                        )}
                      </div>
                      <div className="button-group">
                        <button onClick={() => setEditingClient(selectedClient)}>Edit</button>
                        <button className="danger" onClick={handleDeleteClient}>Delete Client</button>
                      </div>
                    </>
                  )}
                </div>

                <div className="records-section">
                  <h3>Claims History ({selectedClient.records?.length || 0})</h3>

                  <div className="form-section">
                    <h4>Add New Claim</h4>
                    <form onSubmit={handleAddRecord}>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Claim Number *"
                          value={newRecordForm.claimNumber}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, claimNumber: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="date"
                          value={newRecordForm.claimDate}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, claimDate: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Claim Amount"
                          value={newRecordForm.claimAmount}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, claimAmount: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <select 
                          value={newRecordForm.status}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, status: e.target.value })}
                          style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        >
                          <option>Pending</option>
                          <option>Approved</option>
                          <option>Rejected</option>
                          <option>In Review</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{display: 'block', marginBottom: '6px'}}>Record Type *</label>
                        <select
                          value={newRecordForm.recordType}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, recordType: e.target.value })}
                          style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        >
                          <option value="">Select type</option>
                          <option value="Annual">Annual</option>
                          <option value="Renewal">Renewal</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <textarea
                          placeholder="Notes"
                          value={newRecordForm.description}
                          onChange={(e) => setNewRecordForm({ ...newRecordForm, description: e.target.value })}
                        />
                      </div>
                      <button type="submit">Add Claim</button>
                    </form>
                  </div>

                  {selectedClient.records && selectedClient.records.length > 0 ? (
                    selectedClient.records.map((record) => {
                      const colors = getStatusColor(record.status);
                      return (
                        <div key={record.id} className="record-item">
                          <div className="record-title">Claim #{record.claimNumber}</div>
                          <div className="record-date">
                            {record.claimDate}
                          </div>
                          <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                            <strong>Amount:</strong> ${record.claimAmount ? parseFloat(record.claimAmount).toFixed(2) : '0.00'}
                          </div>
                          {record.recordType && (
                            <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                              <strong>Type:</strong> {record.recordType}
                            </div>
                          )}
                          <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                            <strong>Status:</strong> <span style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              backgroundColor: colors.bg,
                              color: colors.text
                            }}>{record.status}</span>
                          </div>
                          {record.description && (
                            <div className="record-description">{record.description}</div>
                          )}
                          <button
                            className="danger record-delete"
                            onClick={() => handleDeleteRecord(record.id)}
                          >
                            Delete Claim
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">No claims yet. Add one above!</div>
                  )}
                </div>
              </>
            ) : (
              <div className="welcome-message">
                👈 Select a client from the list to view details and claims
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// Claims Management Component
function ClaimsManagementPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const clientsSidebarRef = React.useRef(null);
  const [newRecordForm, setNewRecordForm] = useState({
    claimNumber: '',
    claimAmount: '',
    claimDate: new Date().toISOString().split('T')[0],
    status: 'Pending',
    recordType: '',
    description: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clientsSidebarRef.current) clientsSidebarRef.current.scrollTop = 0;
  }, [searchQuery]);

  const fetchClients = async () => {
    try {
      const response = await axios.get('/api/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchClientDetail = async (clientId) => {
    try {
      const response = await axios.get(`/api/clients/${clientId}`);
      setSelectedClient(response.data);
    } catch (error) {
      console.error('Error fetching client detail:', error);
    }
  };

  // helper used when pressing Enter in claims search: select top match
  const isNumericQueryLocal = (q) => /^\d+$/.test(q.trim());
  const handleClaimsSearchEnterLocal = (qInput, localFetchClientDetail) => {
    const q = qInput.trim().toLowerCase();
    const filtered = clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return (q === '' || name.includes(q) || phone.includes(q));
    });
    if (filtered.length > 0) {
      const first = filtered[0];
      setSearchQuery(isNumericQueryLocal(q) ? (first.phone || first.name) : (first.name));
      localFetchClientDetail(first.id);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }
    if (!newRecordForm.claimNumber.trim()) {
      alert('Claim number is required');
      return;
    }
    if (!newRecordForm.recordType) {
      alert('Please select record type');
      return;
    }
    try {
      await axios.post(`/api/clients/${selectedClient.id}/records`, newRecordForm);
      setNewRecordForm({ claimNumber: '', claimAmount: '', claimDate: new Date().toISOString().split('T')[0], status: 'Pending', recordType: '', description: '' });
      fetchClientDetail(selectedClient.id);
      triggerDriveUpload();
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Error adding record');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Delete this claim?')) {
      try {
        await axios.delete(`/api/records/${recordId}`);
        fetchClientDetail(selectedClient.id);
        triggerDriveUpload();
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error deleting record');
      }
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Approved':
        return { bg: '#d4edda', text: '#155724' };
      case 'Rejected':
        return { bg: '#f8d7da', text: '#721c24' };
      case 'In Review':
        return { bg: '#fff3cd', text: '#856404' };
      default:
        return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  return (
    <div>
      <div className="claims-container">
        <div className="claims-sidebar">
          <h2>Select Client</h2>
          <div style={{marginBottom: '15px'}}>
              <input
                type="text"
                placeholder="Search client by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleClaimsSearchEnterLocal(searchQuery, fetchClientDetail); } }}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
          </div>
          
          <div ref={clientsSidebarRef} className="clients-list-claims">
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              let filtered = clients.filter(c => {
                const name = (c.name || '').toLowerCase();
                const phone = String(c.phone || '').toLowerCase();
                return (q === '' || name.includes(q) || phone.includes(q));
              });
              if (filtered.length === 0) return (<div className="empty-state">No clients found.</div>);
              if (q) {
                filtered.sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aScore = aName.startsWith(q) ? 2 : (aName.includes(q) ? 1 : 0);
                  const bScore = bName.startsWith(q) ? 2 : (bName.includes(q) ? 1 : 0);
                  if (aScore !== bScore) return bScore - aScore;
                  return aName.localeCompare(bName);
                });
              } else {
                filtered.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
              }
              return filtered.map((client) => (
                <div
                  key={client.id}
                  className={`client-item-claims ${selectedClient?.id === client.id ? 'active' : ''}`}
                  onClick={() => { setSearchQuery(/^\d+$/.test(q) ? (client.phone || client.name) : (client.name)); fetchClientDetail(client.id); }}
                >
                  <strong>{client.name}</strong>
                  {client.vehicleNumberPlate && <div style={{ fontSize: '0.85em', color: '#666' }}>🚗 {client.vehicleNumberPlate}</div>}
                </div>
              ))
            })()}
          </div>
        </div>

        <div className="claims-main">
          {selectedClient ? (
            <>
              <h2>{selectedClient.name} - Claims Management</h2>
              
              <div className="form-section">
                <h3>Add New Claim</h3>
                <form onSubmit={handleAddRecord}>
                  <div className="form-group">
                    <label>Claim Number *</label>
                    <input
                      type="text"
                      placeholder="Enter claim number"
                      value={newRecordForm.claimNumber}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, claimNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Claim Date</label>
                    <input
                      type="date"
                      value={newRecordForm.claimDate}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, claimDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Claim Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter amount"
                      value={newRecordForm.claimAmount}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, claimAmount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={newRecordForm.status}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, status: e.target.value })}
                      style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                    >
                      <option>Pending</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                      <option>In Review</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Record Type *</label>
                    <select
                      value={newRecordForm.recordType}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, recordType: e.target.value })}
                      style={{padding: '8px 10px', borderRadius: '4px', border: '1px solid #ddd'}}
                    >
                      <option value="">Select type</option>
                      <option value="Annual">Annual</option>
                      <option value="Renewal">Renewal</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      placeholder="Enter notes"
                      value={newRecordForm.description}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="success">Add Claim</button>
                </form>
              </div>

              <div className="records-section">
                <h3>Claims History ({selectedClient.records?.length || 0})</h3>
                {selectedClient.records && selectedClient.records.length > 0 ? (
                  selectedClient.records.map((record) => {
                    const colors = getStatusColor(record.status);
                    return (
                      <div key={record.id} className="record-item">
                        <div className="record-title">Claim #{record.claimNumber}</div>
                        <div className="record-date">{record.claimDate}</div>
                        <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                          <strong>Amount:</strong> ${record.claimAmount ? parseFloat(record.claimAmount).toFixed(2) : '0.00'}
                        </div>
                        {record.recordType && (
                          <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                            <strong>Type:</strong> {record.recordType}
                          </div>
                        )}
                        <div style={{fontSize: '0.95em', marginBottom: '8px'}}>
                          <strong>Status:</strong> <span style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: colors.bg,
                            color: colors.text
                          }}>{record.status}</span>
                        </div>
                        {record.description && (
                          <div className="record-description">{record.description}</div>
                        )}
                        <button
                          className="danger record-delete"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          Delete Claim
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">No claims recorded yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="welcome-message">
              👈 Select a client from the list to manage their claims
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main App Component with Authentication
function DriveStatus() {
  const [authorized, setAuthorized] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await axios.get('/api/drive/status');
      setAuthorized(!!res.data.authorized);
    } catch (err) {
      console.warn('Failed to fetch Drive status', err.message || err);
      setAuthorized(false);
    }
  }

  function handleAuthorize() {
    // Redirect user to server auth endpoint which starts OAuth consent
    window.location.href = '/auth/google';
  }

  async function handleUpload() {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post('/api/drive/upload');
      setMessage(`Upload succeeded: ${res.data.file?.name || res.data.file?.id || 'OK'}`);
      setAuthorized(true);
    } catch (err) {
      setMessage(`Upload failed: ${err.response?.data?.error || err.message}`);
      console.warn('Drive upload error', err.response?.data || err.message || err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
      <div style={{fontSize: '0.9em'}}>
        Drive: {authorized === null ? 'Checking…' : (authorized ? 'Connected' : 'Not connected')}
      </div>
      {authorized ? (
        <button onClick={handleUpload} disabled={loading} style={{padding: '6px 10px'}}>
          {loading ? 'Uploading…' : 'Upload Now'}
        </button>
      ) : (
        <button onClick={handleAuthorize} style={{padding: '6px 10px'}}>Authorize Drive</button>
      )}
      <button onClick={fetchStatus} title="Refresh Drive status" style={{padding: '6px 8px'}}>Refresh</button>
      {message && <div style={{marginLeft: '8px', fontSize: '0.85em'}}>{message}</div>}
    </div>
  );
}
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('expiry'); // expiry, client, claims

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      <header className="header">
        <div className="container">
          <div className="header-content" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <h1>ABIJAY INSURANCE AGENCY</h1>
              <p className="header-motto">Trust us to protect you</p>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <DriveStatus />
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      <div className="nav-tabs">
        <button 
          className={`nav-tab ${currentPage === 'expiry' ? 'active' : ''}`}
          onClick={() => setCurrentPage('expiry')}
        >
          📊 Expiry Dashboard
        </button>
        <button 
          className={`nav-tab ${currentPage === 'client' ? 'active' : ''}`}
          onClick={() => setCurrentPage('client')}
        >
          👥 Clients
        </button>
        <button 
          className={`nav-tab ${currentPage === 'claims' ? 'active' : ''}`}
          onClick={() => setCurrentPage('claims')}
        >
          📋 Claims
        </button>
      </div>

      <div className={`container ${currentPage}-page`}>
        {currentPage === 'expiry' && <InsuranceExpiryDashboard />}
        {currentPage === 'client' && <ClientManagementPage />}
        {currentPage === 'claims' && <ClaimsManagementPage />}
      </div>
    </div>
  );
}
export default App;
