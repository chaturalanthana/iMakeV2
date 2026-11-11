import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, ShoppingBag, Archive, 
  Wallet, Users, Settings, Landmark, BookOpen, Receipt, 
  CreditCard, Network, FileText, Package, Truck, Layers, 
  ArrowUpRight, BarChart2, Tag, Users2, Banknote, CalendarDays, MinusCircle, TrendingUp, DollarSign,
  Factory, RefreshCw, Percent, ClipboardList, ArrowDownLeft, Sliders, Upload, Scale
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const isPathActive = (path) => {
    if (!path) return false;
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    {
      name: 'Production',
      icon: Factory,
      subItems: [
        { name: 'Products', icon: Archive, path: '/products' },
        { name: 'Bill of Materials (BOM)', icon: ClipboardList, path: '/production/boms' },
        { name: 'Work Orders', icon: ClipboardList, path: '/production/work-orders' },
        { name: 'Shop Floor', icon: Factory, path: '/production/shop-floor' },
        { name: 'Planning', icon: Sliders, path: '/production/planning' },
        { name: 'Calendar', icon: CalendarDays, path: '/production/calendar' },
        { name: 'Costing', icon: DollarSign, path: '/production/costing' },
        { name: 'Workstations', icon: Sliders, path: '/production/workstations' },
        { name: 'MRP Planner', icon: FileText, path: '/production/mrp' },
        { name: 'Product Groups', icon: Layers, path: '/production/groups' },
        { name: 'Product Types', icon: Layers, path: '/registries/product-types' },
        { name: 'Brands', icon: Tag, path: '/registries/brands' },
        { name: 'Categories', icon: Layers, path: '/registries/categories' },
        { name: 'UOMs', icon: RefreshCw, path: '/registries/uoms' },
        { name: 'UOM Templates', icon: RefreshCw, path: '/registries/uom-templates' },
      ]
    },
    { 
      name: 'Sales', 
      icon: ShoppingCart, 
      subItems: [
        { name: 'Customers', icon: Users, path: '/sales/customers' },
        { name: 'Customer Categories', icon: Layers, path: '/sales/categories' },
        { name: 'Price Lists', icon: DollarSign, path: '/sales/price-lists' },
        { name: 'Discount Groups', icon: Percent, path: '/sales/discount-groups' },
        { name: 'Quotations', icon: FileText, path: '/sales/quotations' },
        { name: 'Orders', icon: ShoppingCart, path: '/sales/orders' },
        { name: 'Deliveries', icon: Package, path: '/sales/deliveries' },
        { name: 'Invoices', icon: Receipt, path: '/sales/invoices' },
      ]
    },
    { 
      name: 'Purchases', 
      icon: ShoppingBag, 
      subItems: [
        { name: 'Suppliers', icon: Truck, path: '/procurement/suppliers' },
        { name: 'Payment Terms', icon: CreditCard, path: '/procurement/payment-terms' },
        { name: 'Tax Groups', icon: Percent, path: '/procurement/tax-groups' },
        { name: 'Withholding Tax Groups', icon: MinusCircle, path: '/procurement/withholding-tax-groups' },
        { name: 'Purchase Requisitions', icon: ClipboardList, path: '/procurement/purchase-requisitions' },
        { name: 'Purchase Orders', icon: ShoppingBag, path: '/procurement/purchase-orders' },
        { name: 'GRNs', icon: Package, path: '/procurement/grn' },
        { name: 'Supplier Invoices', icon: FileText, path: '/procurement/supplier-invoices' },
      ]
    },
    { 
      name: 'Stock', 
      icon: Archive, 
      subItems: [
        { name: 'Warehouses', icon: Layers, path: '/registries/warehouses' },
        { name: 'Bins', icon: Layers, path: '/warehouse/bins' },
        { name: 'Batches', icon: Package, path: '/warehouse/batches' },
        { name: 'Pallets', icon: Boxes, path: '/warehouse/pallets' },
        { name: 'Material Requests', icon: ClipboardList, path: '/warehouse/material-requests' },
        { name: 'Batch Receipts', icon: ArrowDownLeft, path: '/warehouse/batch-receipts/new' },
        { name: 'Goods Transfers', icon: RefreshCw, path: '/warehouse/goods-transfers' },
        { name: 'Returns', icon: ArrowUpRight, path: '/warehouse/returns' },
        { name: 'Cycle Counts', icon: BarChart2, path: '/warehouse/cycle-counts' },
        { name: 'Allocations', icon: ClipboardList, path: '/warehouse/allocations' },
        { name: 'Stock Reports', icon: FileText, path: '/warehouse/stock-reports' },
        { name: 'Stock Receipts', icon: ArrowDownLeft, path: '/warehouse/receipts' },
        { name: 'Stock Issues', icon: ArrowUpRight, path: '/warehouse/issues' },
        { name: 'Stock Transfers', icon: RefreshCw, path: '/warehouse/transfers' },
        { name: 'Stock Adjustments', icon: BarChart2, path: '/warehouse/adjustments' },
        { name: 'Inventory Report', icon: FileText, path: '/warehouse/inventory-report' },
        { name: 'Labels', icon: Tag, path: '/warehouse/labels' },
        { name: 'Stock Ledger', icon: Layers, path: '/warehouse/movements' },
      ]
    },
    { 
      name: 'Finance', 
      icon: Wallet, 
      subItems: [
        { name: 'Chart of Accounts', icon: Network, path: '/finance/accounts' },
        { name: 'General Ledger', icon: Landmark, path: '/finance/ledger' },
        { name: 'Trial Balance', icon: Scale, path: '/finance/trial-balance' },
        { name: 'Profit & Loss', icon: TrendingUp, path: '/finance/pnl' },
        { name: 'Cash Flow', icon: Landmark, path: '/finance/cashflow' },
        { name: 'Balance Sheet', icon: Landmark, path: '/finance/balancesheet' },
        { name: 'Cash Book', icon: Landmark, path: '/finance/cashbook' },
        { name: 'Bank Book', icon: Landmark, path: '/finance/bankbook' },
        { name: 'Customer Outstanding', icon: FileText, path: '/sales/outstanding' },
        { name: 'Supplier Outstanding', icon: FileText, path: '/procurement/outstanding' },
        { name: 'Journal Entries', icon: BookOpen, path: '/finance/journals' },
        { name: 'Payment Receipts', icon: Receipt, path: '/finance/receipts' },
        { name: 'Payment Vouchers', icon: CreditCard, path: '/finance/vouchers' },
        { name: 'Currencies', icon: Banknote, path: '/finance/currencies' },
        { name: 'Tax Groups', icon: Percent, path: '/finance/tax-groups' },
        { name: 'VAT Report', icon: FileText, path: '/finance/vat' },
        { name: 'Bank Reconciliation', icon: Landmark, path: '/finance/reconciliation' },
      ]
    },
    {
      name: 'HR',
      icon: Users2,
      subItems: [
        { name: 'Employees', icon: Users2, path: '/hr/employees' },
        { name: 'Additions Master', icon: TrendingUp, path: '/hr/additions' },
        { name: 'Deductions Registry', icon: MinusCircle, path: '/hr/deductions' },
        { name: 'Leave Management', icon: CalendarDays, path: '/hr/leaves' },
        { name: 'Loan Management', icon: Banknote, path: '/hr/loans' },
        { name: 'Salary Process', icon: DollarSign, path: '/hr/salary-process' },
        { name: 'Pay Slips', icon: FileText, path: '/hr/payslips' },
        { name: 'Holiday Calendar', icon: CalendarDays, path: '/hr/holidays' },
        { name: 'EPF / ETF', icon: Landmark, path: '/hr/statutory' },
      ]
    },
  ];

  const systemItems = [
    { 
      name: 'Settings', 
      icon: Settings, 
      subItems: [
        { name: 'Users', icon: Users, path: '/settings/users' },
        { name: 'Roles', icon: Layers, path: '/settings/roles' },
        { name: 'Data import', icon: Upload, path: '/settings/import' },
      ] 
    }
  ];

  const isMenuPartiallyActive = (item) => {
    if (item.subItems) {
      return item.subItems.some(sub => location.pathname.startsWith(sub.path));
    }
    return isPathActive(item.path);
  };

  useEffect(() => {
    if (window.matchMedia('(max-width: 720px)').matches) {
      setExpandedMenu(null);
      return;
    }
    const currentActive = menuItems.find(m => isMenuPartiallyActive(m)) || systemItems.find(m => isMenuPartiallyActive(m));
    if (currentActive && !expandedMenu) {
      setExpandedMenu(currentActive);
    }
  }, [location.pathname]);

  const handleMenuClick = (item) => {
    if (expandedMenu?.name === item.name) {
      // Toggle off if it's already open
      setExpandedMenu(null);
    } else {
      setShouldAnimate(true);
      setExpandedMenu(item);
    }
  };

  const displayModule = expandedMenu;
  const showSubPanel = displayModule?.subItems && displayModule.subItems.length > 0;

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>
        {`
          .slim-sidebar {
            width: 76px;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            flex-shrink: 0;
          }
          .slim-sidebar:hover {
            width: 220px;
          }
          .logo-container {
            padding: 0 27px;
            transition: padding 0.3s ease;
          }
          .slim-sidebar:hover .logo-container {
            padding: 0 24px;
            justify-content: flex-start !important;
          }
          .logo-text {
            font-size: 1.1rem;
            font-weight: 700;
            color: #fff;
            margin-left: 12px;
            opacity: 0;
            transform: translateX(-10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            white-space: nowrap;
            pointer-events: none;
            display: none;
          }
          .slim-sidebar:hover .logo-text {
            opacity: 1;
            transform: translateX(0);
            display: block;
          }
          .slim-sidebar .side-menu-btn {
            display: flex;
            align-items: center;
            width: 76px;
            padding: 0 27px !important;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease !important;
            overflow: hidden;
            white-space: nowrap;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
            text-decoration: none !important;
            line-height: 0.9 !important;
            font-size: 0.9rem !important;
            font-weight: 700 !important;
            border-radius: 0px !important;
          }
          .slim-sidebar:hover .side-menu-btn {
            width: 220px;
            padding: 0 24px !important;
          }
          .menu-item-text {
            margin-left: 12px;
            opacity: 0;
            transform: translateX(-10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            pointer-events: none;
            display: none;
            line-height: 0.9 !important;
            font-size: 0.9rem !important;
          }
          .slim-sidebar:hover .menu-item-text {
            opacity: 1;
            transform: translateX(0);
            display: inline;
          }
          .slim-sidebar .main-nav {
            padding: 0;
            box-sizing: border-box;
            transition: padding 0.3s ease;
          }
          .slim-sidebar:hover .main-nav {
            align-items: flex-start !important;
            padding: 0;
          }
          .slim-sidebar .bottom-nav {
            padding: 0;
            box-sizing: border-box;
            transition: padding 0.3s ease;
          }
          .slim-sidebar:hover .bottom-nav {
            align-items: flex-start !important;
            padding: 0;
          }
          @media (max-width: 720px) {
            .sub-panel {
              position: fixed !important;
              left: 76px;
              top: 0;
              height: 100vh;
              z-index: 60;
            }
          }
        `}
      </style>
      {/* 
        Layer 1: Main Section Layer (Slim Bar) 
      */}
      <aside className="slim-sidebar" style={{
        backgroundColor: '#0F172A', /* Dark Slate Sidebar */
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem 0'
      }}>
        {/* Brand Logo Mini */}
        <div className="logo-container" style={{ height: '50px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.2rem', boxShadow: 'none', flexShrink: 0 }}>
            iM
          </div>
          <span className="logo-text">iMake</span>
        </div>

        {/* Main Modules */}
        <nav className="main-nav" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0px', width: '100%', alignItems: 'center' }}>
          {menuItems.map((item) => {
            const isActive = isMenuPartiallyActive(item);
            const isExpandedLocal = expandedMenu?.name === item.name;

            return item.path && !item.subItems ? (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => handleMenuClick(item)}
                style={{
                  height: '48px',
                  borderRadius: '0px',
                  backgroundColor: isExpandedLocal ? '#1e293b' : 'transparent',
                  color: isActive ? 'var(--accent)' : isExpandedLocal ? '#f8fafc' : '#94a3b8',
                  position: 'relative'
                }}
                className="side-menu-btn side-menu-item"
                title={item.name}
              >
                <item.icon size={22} style={{ flexShrink: 0 }} />
                <span className="menu-item-text">{item.name}</span>
              </NavLink>
            ) : (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item)}
                style={{
                  height: '48px',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  backgroundColor: isExpandedLocal ? '#1e293b' : 'transparent',
                  color: isActive ? 'var(--accent)' : isExpandedLocal ? '#f8fafc' : '#94a3b8',
                  position: 'relative'
                }}
                className="side-menu-btn side-menu-item"
                title={item.name}
              >
                <item.icon size={22} style={{ flexShrink: 0 }} />
                <span className="menu-item-text">{item.name}</span>
                {isActive && !isExpandedLocal && <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '20px', backgroundColor: 'var(--accent)', borderRadius: '4px' }} />}
              </button>
            );
          })}
        </nav>

        {/* System / Bottom Modules */}
        <div className="bottom-nav" style={{ display: 'flex', flexDirection: 'column', gap: '0px', width: '100%', alignItems: 'center', marginTop: 'auto' }}>
          {systemItems.map(item => {
            const isActive = isMenuPartiallyActive(item);
            const isExpandedLocal = expandedMenu?.name === item.name;

            return item.path && !item.subItems ? (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => handleMenuClick(item)}
                style={{
                  height: '48px',
                  borderRadius: '0px',
                  backgroundColor: isExpandedLocal ? '#1e293b' : 'transparent',
                  color: isActive ? 'var(--accent)' : isExpandedLocal ? '#f8fafc' : '#94a3b8',
                  position: 'relative'
                }}
                className="side-menu-btn side-menu-item"
                title={item.name}
              >
                <item.icon size={22} style={{ flexShrink: 0 }} />
                <span className="menu-item-text">{item.name}</span>
              </NavLink>
            ) : (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item)}
                style={{
                  height: '48px',
                  borderRadius: '0px',
                  cursor: 'pointer',
                  backgroundColor: isExpandedLocal ? '#1e293b' : 'transparent',
                  color: isActive ? 'var(--accent)' : isExpandedLocal ? '#f8fafc' : '#94a3b8',
                  position: 'relative'
                }}
                className="side-menu-btn side-menu-item"
                title={item.name}
              >
                <item.icon size={22} style={{ flexShrink: 0 }} />
                <span className="menu-item-text">{item.name}</span>
                {isActive && !isExpandedLocal && <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '20px', backgroundColor: 'var(--accent)', borderRadius: '4px' }} />}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 
        Layer 2: Sub Section Side Panel (Collapsible)
      */}
      <aside className="sub-panel" style={{
        width: showSubPanel ? '240px' : '0px',
        opacity: showSubPanel ? 1 : 0,
        backgroundColor: '#f8fafc', /* Very light gray bg */
        borderRight: showSubPanel ? '1px solid var(--border-color)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: showSubPanel ? '4px 0 15px rgba(0,0,0,0.03)' : 'none'
      }}>
        <div style={{ width: '240px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header of Side Panel */}
          <div style={{ height: '70px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', borderBottom: '1px solid transparent' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {displayModule?.name}
            </h3>
          </div>

          {/* Sub Menu Links */}
          <div style={{ padding: '1rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0px', flex: 1, overflowY: 'auto' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: '0.5rem' }}>
              Menu
            </p>
            {/* Add a style block for the link animation */}
            <style>
              {`
                @keyframes linkFadeIn {
                  0% { opacity: 0; transform: translateX(-8px); }
                  100% { opacity: 1; transform: translateX(0); }
                }
                .side-menu-item:active {
                  transform: scale(0.92);
                }
              `}
            </style>
            {displayModule?.subItems?.map((subItem, index) => {
               const isActive = isPathActive(subItem.path);
               return (
                 <NavLink
                   key={subItem.name}
                   to={subItem.path}
                   style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: '0.75rem',
                     padding: '0.45rem 0.85rem',
                     borderRadius: '8px',
                     textDecoration: 'none',
                     color: isActive ? 'var(--accent)' : '#475569',
                     backgroundColor: 'transparent',
                     fontWeight: 700,
                     fontSize: '0.9rem',
                     whiteSpace: 'nowrap',
                     transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s',
                     animation: (showSubPanel && shouldAnimate) ? `linkFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards ${index * 0.05}s` : 'none',
                     opacity: (showSubPanel && shouldAnimate) ? 0 : 1 // Set to 1 if no animation, otherwise 0 to be animated in
                   }}
                   className="side-menu-item"
                 >
                   <subItem.icon size={16} color={isActive ? "var(--accent)" : "#94a3b8"} />
                   {subItem.name}
                 </NavLink>
               );
             })}
          </div>
        </div>
      </aside>
    </div>
  );
}
