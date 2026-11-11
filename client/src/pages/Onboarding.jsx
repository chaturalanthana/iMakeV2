import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, MapPin, CircleDollarSign, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Onboarding() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ 
    tenantName: '', address: '', currency: 'LKR',
    email: '', password: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/register', formData);
      // Auto-login on success
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      window.location.href = '/dashboard';
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Left side graphical pane */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem', position: 'relative', overflow: 'hidden' }} className="d-none d-lg-flex">
        <div style={{ zIndex: 1, animation: 'slideUp 0.8s ease' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Scale your <br />
            <span style={{ background: 'linear-gradient(to right, var(--accent-secondary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>enterprise</span> seamlessly.
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.6 }}>
            A unified PERN ERP providing total operational control, advanced analytics, and strict data isolation across multiple tenant environments.
          </p>
        </div>
        
        {/* Animated decorative graphics */}
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--accent)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.3, animation: 'pulseGlow 8s infinite' }}></div>
        <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: 'var(--accent-secondary)', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.2, animation: 'pulseGlow 12s infinite alternate' }}></div>
        
        <div className="glass-panel" style={{ position: 'absolute', right: '15%', top: '35%', padding: '1.5rem', animation: 'float 6s ease-in-out infinite' }}>
          <Sparkles color="var(--accent)" />
          <h3 style={{ marginTop: '0.5rem', fontWeight: '600' }}>Multi-Tenant DB</h3>
        </div>
      </div>

      {/* Right side form */}
      <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '3rem', animation: 'slideUp 0.5s ease-out', position: 'relative' }}>
          
          {step === 2 && (
            <button onClick={() => setStep(1)} style={{ position: 'absolute', top: '2rem', left: '2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}

          <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: step === 2 ? '1.5rem' : '0' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {step === 1 ? 'Organization Setup' : 'Admin Profile'}
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              {step === 1 ? 'Step 1: Configure your core workspace identity' : 'Step 2: Create your primary administrative account'}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '1rem' }}>
              <div style={{ width: '30px', height: '4px', borderRadius: '4px', background: step >= 1 ? 'var(--accent)' : 'var(--border-color)' }} />
              <div style={{ width: '30px', height: '4px', borderRadius: '4px', background: step >= 2 ? 'var(--accent)' : 'var(--border-color)' }} />
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '8px', color: 'var(--error)', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                <div style={{ position: 'relative' }}>
                  <Building2 style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                  <input
                    type="text"
                    name="tenantName"
                    placeholder="Organization / Tenant Name *"
                    value={formData.tenantName}
                    onChange={handleChange}
                    className="input-field"
                    style={{ paddingLeft: '48px' }}
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <MapPin style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                  <input
                    type="text"
                    name="address"
                    placeholder="Headquarters Address (Optional)"
                    value={formData.address}
                    onChange={handleChange}
                    className="input-field"
                    style={{ paddingLeft: '48px' }}
                    autoComplete="off"
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <CircleDollarSign style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="input-field"
                    style={{ paddingLeft: '48px', appearance: 'none' }}
                  >
                    <option value="LKR">LKR - Sri Lankan Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="INR">INR - Indian Rupee</option>
                  </select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                  <input
                    type="email"
                    name="email"
                    placeholder="Admin Email Address *"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                    style={{ paddingLeft: '48px' }}
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Secure Password *"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field"
                    style={{ paddingLeft: '48px' }}
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{step === 1 ? 'Loading...' : 'Initializing Workspace...'}</span>
                </>
              ) : (
                <>
                  <span>{step === 1 ? 'Continue to Admin Profile' : 'Create Tenant & Sign In'}</span>
                  {step === 1 && <ArrowRight size={20} />}
                </>
              )}
            </button>
          </form>
          
          <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Already have an account? <span onClick={() => navigate('/login')} style={{ color: 'var(--accent-secondary)', cursor: 'pointer' }}>Sign in here</span>
          </p>
        </div>
      </div>
    </div>
  );
}
