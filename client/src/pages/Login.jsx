import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/login', formData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Authentication failed. Please check your credentials.';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Left side graphical pane - Matches Onboarding to feel consistent */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem', position: 'relative', overflow: 'hidden' }} className="d-none d-lg-flex">
        <div style={{ zIndex: 1, animation: 'slideUp 0.8s ease' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Welcome <br />
            <span style={{ background: 'linear-gradient(to right, var(--accent-secondary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>back.</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.6 }}>
            Access your secure iMake workspace and manage your enterprise operations seamlessly.
          </p>
        </div>
        
        {/* Animated decorative graphics */}
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--accent)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.3, animation: 'pulseGlow 8s infinite' }}></div>
        <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: 'var(--accent-secondary)', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.2, animation: 'pulseGlow 12s infinite alternate' }}></div>
        
        <div className="glass-panel" style={{ position: 'absolute', right: '15%', top: '35%', padding: '1.5rem', animation: 'float 6s ease-in-out infinite' }}>
          <Sparkles color="var(--accent)" />
          <h3 style={{ marginTop: '0.5rem', fontWeight: '600' }}>Tenant Portal</h3>
        </div>
      </div>

      {/* Right side form */}
      <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '3rem', animation: 'slideUp 0.5s ease-out' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Sign In</h2>
            <p style={{ color: 'var(--text-muted)' }}>Securely access your isolated workspace</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '8px', color: 'var(--error)', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="input-field"
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="input-field"
                style={{ paddingLeft: '48px' }}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loading ? 'Authenticating...' : 'Sign Into Workspace'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>
          
          <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Don't have an organization workspace yet? <span onClick={() => navigate('/onboarding')} style={{ color: 'var(--accent-secondary)', cursor: 'pointer' }}>Register here</span>
          </p>
        </div>
      </div>
    </div>
  );
}
