import axios from 'axios';
import { Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ExportButton({ url, filename = 'export.xlsx', params = {} }) {
  const { showToast } = useToast();

  const download = async () => {
    try {
      const res = await axios.get(url, {
        params: { ...params, export: 'xlsx' },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      showToast('Could not export this list', 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '0.55rem 1.25rem',
        background: '#fff',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: 'var(--text-main)',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      <Download size={16} /> Export
    </button>
  );
}
