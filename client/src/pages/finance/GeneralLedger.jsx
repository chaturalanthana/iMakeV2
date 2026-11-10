import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppLayout from '../../components/layout/AppLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import DataTable from '../../components/ui/DataTable';
import { Landmark, ChevronDown, ChevronRight, PlusCircle, MinusCircle, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function GeneralLedger() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [ledgerTree, setLedgerTree] = useState([]);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [accountsRes, linesRes] = await Promise.all([
        axios.get('/api/finance/accounts', config),
        axios.get('/api/finance/ledger', config)
      ]);
      
      setAccounts(accountsRes.data);
      setLines(linesRes.data);
      
      // Build hierarchical tree
      const tree = buildLedgerTree(accountsRes.data, linesRes.data);
      setLedgerTree(tree);
      
      // Auto-expand top level nodes on initial load
      const initialExpanded = new Set();
      tree.forEach(root => {
        if (root.children.length > 0) {
          initialExpanded.add(root.id);
        }
      });
      setExpandedAccounts(initialExpanded);
      
    } catch (error) {
      console.error(`Failed to fetch ledger data:`, error);
      showToast('Failed to load general ledger', 'error');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const getNormalBalance = (debit, credit, type) => {
    const d = parseFloat(debit || 0);
    const c = parseFloat(credit || 0);
    if (type === 'ASSET' || type === 'EXPENSE') {
      return d - c;
    }
    return c - d;
  };

  const buildLedgerTree = (accountsData, linesData) => {
    const linesByAccount = {};
    linesData.forEach(line => {
      if (!linesByAccount[line.accountId]) {
        linesByAccount[line.accountId] = [];
      }
      linesByAccount[line.accountId].push(line);
    });

    const accountsMap = {};
    accountsData.forEach(acc => {
      accountsMap[acc.id] = {
        ...acc,
        children: [],
        lines: linesByAccount[acc.id] || [],
        totals: { debit: 0, credit: 0, balance: 0 }
      };
    });

    const roots = [];
    accountsData.forEach(acc => {
      const accNode = accountsMap[acc.id];
      if (acc.parentId && accountsMap[acc.parentId]) {
        accountsMap[acc.parentId].children.push(accNode);
      } else {
        roots.push(accNode);
      }
    });

    const calculateTotals = (node) => {
      let debitSum = 0;
      let creditSum = 0;

      node.lines.forEach(line => {
        debitSum += parseFloat(line.debit || 0);
        creditSum += parseFloat(line.credit || 0);
      });

      node.children.forEach(child => {
        const childTotals = calculateTotals(child);
        debitSum += childTotals.debit;
        creditSum += childTotals.credit;
      });

      node.totals = {
        debit: debitSum,
        credit: creditSum,
        balance: getNormalBalance(debitSum, creditSum, node.type)
      };

      return node.totals;
    };

    roots.forEach(root => calculateTotals(root));
    return roots;
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num < 0) {
      return `($${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExpandAll = () => {
    const ids = new Set();
    const traverse = (node) => {
      ids.add(node.id);
      node.children.forEach(traverse);
    };
    ledgerTree.forEach(traverse);
    setExpandedAccounts(ids);
  };

  const handleCollapseAll = () => {
    setExpandedAccounts(new Set());
  };

  const filterTree = (nodes, query) => {
    if (!query.trim()) return nodes;
    const lowerQuery = query.toLowerCase();

    const checkMatch = (node) => {
      const nameMatch = node.name.toLowerCase().includes(lowerQuery) || node.code.toLowerCase().includes(lowerQuery);
      const matchingChildren = node.children.map(child => checkMatch(child)).filter(Boolean);
      
      if (nameMatch || matchingChildren.length > 0) {
        return {
          ...node,
          children: matchingChildren
        };
      }
      return null;
    };

    return nodes.map(checkMatch).filter(Boolean);
  };

  const flattenTree = (nodes, depth = 0) => {
    const result = [];
    nodes.forEach(node => {
      const isExpanded = expandedAccounts.has(node.id);
      const hasSubAccounts = node.children.length > 0;
      const canExpand = hasSubAccounts;

      // Account group row
      result.push({
        id: `acc-${node.id}`,
        rowType: 'ACCOUNT_ROW',
        depth,
        canExpand,
        isExpanded,
        nodeId: node.id,
        accountLabel: `${node.code} - ${node.name}`,
        typeLabel: node.type,
        debit: node.totals.debit,
        credit: node.totals.credit,
        balance: node.totals.balance,
        rawNode: node
      });

      if (isExpanded) {
        // Children sub-accounts
        if (hasSubAccounts) {
          result.push(...flattenTree(node.children, depth + 1));
        }

        // Subtotal row
        if (hasSubAccounts) {
          result.push({
            id: `total-${node.id}`,
            rowType: 'TOTAL_ROW',
            depth,
            accountLabel: `Total - ${node.code} - ${node.name}`,
            typeLabel: '',
            debit: node.totals.debit,
            credit: node.totals.credit,
            balance: node.totals.balance,
            nodeId: node.id
          });
        }
      }
    });
    return result;
  };

  const visibleTree = filterTree(ledgerTree, searchQuery);
  const tableData = flattenTree(visibleTree, 0);

  const toggleExpand = (nodeId) => {
    const next = new Set(expandedAccounts);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedAccounts(next);
  };

  const columns = [
    {
      header: 'Account',
      accessor: 'accountLabel',
      width: '40%',
      render: (row) => {
        const isAccount = row.rowType === 'ACCOUNT_ROW';
        const isTotal = row.rowType === 'TOTAL_ROW';
        
        return (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            paddingLeft: `${row.depth * 16}px`,
            fontWeight: isAccount || isTotal ? 700 : 400,
            fontSize: '0.875rem'
          }}>
            {isAccount && row.canExpand ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(row.nodeId);
                }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--accent)'
                }}
              >
                {row.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : null}
            <span style={{ 
              fontStyle: isTotal ? 'italic' : 'normal',
              color: 'var(--text-main)'
            }}>
              {row.accountLabel}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Type',
      accessor: 'typeLabel',
      width: '15%',
      render: (row) => (
        <span style={{ 
          fontSize: '0.8rem', 
          color: 'var(--text-muted)',
          fontWeight: row.rowType === 'ACCOUNT_ROW' ? 600 : 400
        }}>
          {row.typeLabel}
        </span>
      )
    },
    {
      header: 'Debit',
      accessor: 'debit',
      width: '15%',
      align: 'right',
      render: (row) => {
        const showVal = row.rowType !== 'ACCOUNT_ROW' || row.debit > 0;
        return (
          <span style={{ 
            fontWeight: 700,
            fontSize: '0.85rem'
          }}>
            {showVal && row.debit > 0 ? formatCurrency(row.debit) : ''}
          </span>
        );
      }
    },
    {
      header: 'Credit',
      accessor: 'credit',
      width: '15%',
      align: 'right',
      render: (row) => {
        const showVal = row.rowType !== 'ACCOUNT_ROW' || row.credit > 0;
        return (
          <span style={{ 
            fontWeight: 700,
            fontSize: '0.85rem'
          }}>
            {showVal && row.credit > 0 ? formatCurrency(row.credit) : ''}
          </span>
        );
      }
    },
    {
      header: 'Balance',
      accessor: 'balance',
      width: '15%',
      align: 'right',
      render: (row) => (
        <span style={{ 
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          {formatCurrency(row.balance)}
        </span>
      )
    }
  ];

  const extraActions = (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button 
        onClick={handleExpandAll}
        style={{ padding: '0.5rem 0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
      >
        Expand All
      </button>
      <button 
        onClick={handleCollapseAll}
        style={{ padding: '0.5rem 0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
      >
        Collapse All
      </button>
      <button 
        onClick={() => window.print()}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
      >
        <Printer size={14} /> Print
      </button>
    </div>
  );

  return (
    <AppLayout title="General Ledger" icon={Landmark}>
      {isInitialLoad ? (
        <PageSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          loading={loading}
          searchPlaceholder="Search accounts, codes..."
          searchKeys={[]} // Disable internal local search in favor of tree-filtering
          itemsPerPage={10000} // Keep tree layout aligned on a single scrollable page
          extraActions={extraActions}
          noDataMessage="No accounts found."
          onRowClick={(row) => {
            if (row.nodeId) {
              navigate(`/finance/ledger/${row.nodeId}`);
            }
          }}
        />
      )}
    </AppLayout>
  );
}

