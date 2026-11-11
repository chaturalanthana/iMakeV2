import axios from 'axios';
import { Download } from 'lucide-react';
import ActionButton from './ActionButton';
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
    <ActionButton variant="secondary" icon={Download} onClick={download}>
      Export
    </ActionButton>
  );
}
