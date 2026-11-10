import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { LayoutProvider } from './context/LayoutContext';
import PersistentLayout from './components/layout/PersistentLayout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Products from './pages/Products';
import NewProduct from './pages/NewProduct';
import BOMs from './pages/production/BOMs';
import NewBOM from './pages/production/NewBOM';
import PlanningBoard from './pages/production/PlanningBoard';
import WorkOrders from './pages/production/WorkOrders';
import WorkOrderDetail from './pages/production/WorkOrderDetail';
import ShopFloor from './pages/production/ShopFloor';
import ProductionCalendar from './pages/production/ProductionCalendar';
import ProductionCosting from './pages/production/ProductionCosting';
import NewProductionOrder from './pages/production/NewProductionOrder';
import Workstations from './pages/production/Workstations';
import NewWorkstation from './pages/production/NewWorkstation';
import MRPPlanner from './pages/production/MRPPlanner';
import ProductGroups from './pages/production/ProductGroups';
import Brands from './pages/registries/Brands';
import Categories from './pages/registries/Categories';
import ProductTypes from './pages/registries/ProductTypes';
import Warehouses from './pages/registries/Warehouses';
import Uoms from './pages/registries/Uoms';
import PaymentTerms from './pages/registries/PaymentTerms';
import ChartOfAccounts from './pages/finance/ChartOfAccounts';
import GeneralLedger from './pages/finance/GeneralLedger';
import LedgerDetails from './pages/finance/LedgerDetails';
import ProfitAndLoss from './pages/finance/ProfitAndLoss';
import CashFlow from './pages/finance/CashFlow';
import BalanceSheet from './pages/finance/BalanceSheet';
import CashBook from './pages/finance/CashBook';
import BankBook from './pages/finance/BankBook';
import VATReport from './pages/finance/VATReport';
import BankReconciliation from './pages/finance/BankReconciliation';
import JournalEntries from './pages/finance/JournalEntries';
import NewJournalEntry from './pages/finance/NewJournalEntry';
import PaymentReceipts from './pages/finance/PaymentReceipts';
import NewPaymentReceipt from './pages/finance/NewPaymentReceipt';
import PaymentVouchers from './pages/finance/PaymentVouchers';
import NewPaymentVoucher from './pages/finance/NewPaymentVoucher';
import Currencies from './pages/finance/Currencies';
import TaxGroups from './pages/finance/TaxGroups';
import NewTaxGroup from './pages/finance/NewTaxGroup';
import Customers from './pages/sales/Customers';
import NewCustomer from './pages/sales/NewCustomer';
import CustomerCategories from './pages/sales/CustomerCategories';
import NewCustomerCategory from './pages/sales/NewCustomerCategory';
import PriceLists from './pages/sales/PriceLists';
import NewPriceList from './pages/sales/NewPriceList';
import DiscountGroups from './pages/sales/DiscountGroups';
import NewDiscountGroup from './pages/sales/NewDiscountGroup';
import Quotations from './pages/sales/Quotations';
import NewQuotation from './pages/sales/NewQuotation';
import Orders from './pages/sales/Orders';
import NewOrder from './pages/sales/NewOrder';
import Deliveries from './pages/sales/Deliveries';
import NewDelivery from './pages/sales/NewDelivery';
import Invoices from './pages/sales/Invoices';
import NewInvoice from './pages/sales/NewInvoice';
import CustomerOutstanding from './pages/sales/CustomerOutstanding';

// Procurement Features
import Suppliers from './pages/procurement/Suppliers';
import NewSupplier from './pages/procurement/NewSupplier';
import PurchaseOrders from './pages/procurement/PurchaseOrders';
import NewPurchaseOrder from './pages/procurement/NewPurchaseOrder';
import GRNs from './pages/procurement/GRNs';
import NewGRN from './pages/procurement/NewGRN';
import PurchaseTaxGroups from './pages/procurement/PurchaseTaxGroups';
import NewPurchaseTaxGroup from './pages/procurement/NewPurchaseTaxGroup';
import PurchaseWithholdingTaxGroups from './pages/procurement/PurchaseWithholdingTaxGroups';
import NewPurchaseWithholdingTaxGroup from './pages/procurement/NewPurchaseWithholdingTaxGroup';
import PurchaseRequisitions from './pages/procurement/PurchaseRequisitions';
import NewPurchaseRequisition from './pages/procurement/NewPurchaseRequisition';
import SupplierOutstanding from './pages/procurement/SupplierOutstanding';
import SupplierInvoices from './pages/procurement/SupplierInvoices';
import NewSupplierInvoice from './pages/procurement/NewSupplierInvoice';
import PartyStatement from './pages/finance/PartyStatement';

// Warehouse / Stock Features
import StockMovements from './pages/warehouse/StockMovements';
import NewStockMovement from './pages/warehouse/NewStockMovement';
import StockIssues from './pages/warehouse/StockIssues';
import NewStockIssue from './pages/warehouse/NewStockIssue';
import StockReceipts from './pages/warehouse/StockReceipts';
import NewStockReceipt from './pages/warehouse/NewStockReceipt';
import StockTransfers from './pages/warehouse/StockTransfers';
import NewStockTransfer from './pages/warehouse/NewStockTransfer';
import StockAdjustments from './pages/warehouse/StockAdjustments';
import NewStockAdjustment from './pages/warehouse/NewStockAdjustment';
import InventoryReport from './pages/warehouse/InventoryReport';

// HR Features
import Employees from './pages/hr/Employees';
import AdditionsMaster from './pages/hr/AdditionsMaster';
import DeductionsRegistry from './pages/hr/DeductionsRegistry';
import LeaveManagement from './pages/hr/LeaveManagement';
import LoanManagement from './pages/hr/LoanManagement';
import SalaryProcess from './pages/hr/SalaryProcess';
import PaySlips from './pages/hr/PaySlips';
import HolidayCalendar from './pages/hr/HolidayCalendar';

// Settings Features
import Users from './pages/settings/Users';
import Roles from './pages/settings/Roles';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <ToastProvider>
      <LayoutProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/onboarding"} replace />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            
            {/* Authenticated Routes wrapped in PersistentLayout */}
            <Route element={<PersistentLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/new" element={<NewProduct />} />
              <Route path="/products/:id" element={<NewProduct />} />
              <Route path="/production/boms" element={<BOMs />} />
              <Route path="/production/boms/new" element={<NewBOM />} />
              <Route path="/production/boms/:productCode/:bomCode" element={<NewBOM />} />
              <Route path="/production/boms/:id" element={<NewBOM />} />
              <Route path="/production/planning" element={<PlanningBoard />} />
              <Route path="/production/work-orders" element={<WorkOrders />} />
              <Route path="/production/work-orders/new" element={<WorkOrderDetail />} />
              <Route path="/production/work-orders/:id" element={<WorkOrderDetail />} />
              <Route path="/production/shop-floor" element={<ShopFloor />} />
              <Route path="/production/shop-floor/:id" element={<ShopFloor />} />
              <Route path="/production/calendar" element={<ProductionCalendar />} />
              <Route path="/production/costing" element={<ProductionCosting />} />
              <Route path="/production/orders" element={<Navigate to="/production/work-orders" replace />} />
              <Route path="/production/orders/new" element={<NewProductionOrder />} />
              <Route path="/production/orders/:id" element={<NewProductionOrder />} />
              <Route path="/production/workstations" element={<Workstations />} />
              <Route path="/production/workstations/new" element={<NewWorkstation />} />
              <Route path="/production/workstations/:id" element={<NewWorkstation />} />
              <Route path="/production/mrp" element={<MRPPlanner />} />
              <Route path="/production/groups" element={<ProductGroups />} />
              <Route path="/registries/brands" element={<Brands />} />
              <Route path="/registries/categories" element={<Categories />} />
              <Route path="/registries/product-types" element={<ProductTypes />} />
              <Route path="/registries/warehouses" element={<Warehouses />} />
              <Route path="/registries/uoms" element={<Uoms />} />
              
              {/* Sales */}
              <Route path="/sales/customers" element={<Customers />} />
              <Route path="/sales/customers/new" element={<NewCustomer />} />
              <Route path="/sales/customers/:id" element={<NewCustomer />} />
              <Route path="/sales/categories" element={<CustomerCategories />} />
              <Route path="/sales/categories/new" element={<NewCustomerCategory />} />
              <Route path="/sales/categories/:id" element={<NewCustomerCategory />} />
              <Route path="/sales/price-lists" element={<PriceLists />} />
              <Route path="/sales/price-lists/new" element={<NewPriceList />} />
              <Route path="/sales/price-lists/:id" element={<NewPriceList />} />
              <Route path="/sales/discount-groups" element={<DiscountGroups />} />
              <Route path="/sales/discount-groups/new" element={<NewDiscountGroup />} />
              <Route path="/sales/discount-groups/:id" element={<NewDiscountGroup />} />
              <Route path="/sales/quotations/new" element={<NewQuotation />} />
              <Route path="/sales/quotations/:id" element={<NewQuotation />} />
              <Route path="/sales/quotations" element={<Quotations />} />
              <Route path="/sales/orders/new" element={<NewOrder />} />
              <Route path="/sales/orders/:id" element={<NewOrder />} />
              <Route path="/sales/orders" element={<Orders />} />
              <Route path="/sales/deliveries/new" element={<NewDelivery />} />
              <Route path="/sales/deliveries/:id" element={<NewDelivery />} />
              <Route path="/sales/deliveries" element={<Deliveries />} />
              <Route path="/sales/invoices/new" element={<NewInvoice />} />
              <Route path="/sales/invoices/:id" element={<NewInvoice />} />
              <Route path="/sales/invoices" element={<Invoices />} />
              <Route path="/sales/outstanding" element={<CustomerOutstanding />} />
              <Route path="/sales/customers/:id/statement" element={<PartyStatement kind="customer" />} />

              {/* Procurement */}
              <Route path="/procurement/suppliers" element={<Suppliers />} />
              <Route path="/procurement/suppliers/new" element={<NewSupplier />} />
              <Route path="/procurement/suppliers/:id" element={<NewSupplier />} />
              <Route path="/procurement/payment-terms" element={<PaymentTerms />} />
              <Route path="/procurement/purchase-orders/new" element={<NewPurchaseOrder />} />
              <Route path="/procurement/purchase-orders/:id" element={<NewPurchaseOrder />} />
              <Route path="/procurement/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/procurement/grn/new" element={<NewGRN />} />
              <Route path="/procurement/grn/:id" element={<NewGRN />} />
              <Route path="/procurement/grn" element={<GRNs />} />
              <Route path="/procurement/supplier-invoices/new" element={<NewSupplierInvoice />} />
              <Route path="/procurement/supplier-invoices/:id" element={<NewSupplierInvoice />} />
              <Route path="/procurement/supplier-invoices" element={<SupplierInvoices />} />
              <Route path="/procurement/purchase-requisitions" element={<PurchaseRequisitions />} />
              <Route path="/procurement/purchase-requisitions/new" element={<NewPurchaseRequisition />} />
              <Route path="/procurement/purchase-requisitions/:id" element={<NewPurchaseRequisition />} />
              <Route path="/procurement/tax-groups" element={<PurchaseTaxGroups />} />
              <Route path="/procurement/tax-groups/new" element={<NewPurchaseTaxGroup />} />
              <Route path="/procurement/tax-groups/:id" element={<NewPurchaseTaxGroup />} />
              <Route path="/procurement/withholding-tax-groups" element={<PurchaseWithholdingTaxGroups />} />
              <Route path="/procurement/withholding-tax-groups/new" element={<NewPurchaseWithholdingTaxGroup />} />
              <Route path="/procurement/withholding-tax-groups/:id" element={<NewPurchaseWithholdingTaxGroup />} />
              <Route path="/procurement/outstanding" element={<SupplierOutstanding />} />
              <Route path="/procurement/suppliers/:id/statement" element={<PartyStatement kind="supplier" />} />

              {/* Stock */}
              <Route path="/warehouse/issues/new" element={<NewStockIssue />} />
              <Route path="/warehouse/issues/:id" element={<NewStockIssue />} />
              <Route path="/warehouse/issues" element={<StockIssues />} />
              <Route path="/warehouse/receipts/new" element={<NewStockReceipt />} />
              <Route path="/warehouse/receipts/:id" element={<NewStockReceipt />} />
              <Route path="/warehouse/receipts" element={<StockReceipts />} />
              <Route path="/warehouse/transfers/new" element={<NewStockTransfer />} />
              <Route path="/warehouse/transfers/:id" element={<NewStockTransfer />} />
              <Route path="/warehouse/transfers" element={<StockTransfers />} />
              <Route path="/warehouse/adjustments/new" element={<NewStockAdjustment />} />
              <Route path="/warehouse/adjustments/:id" element={<NewStockAdjustment />} />
              <Route path="/warehouse/adjustments" element={<StockAdjustments />} />
              <Route path="/warehouse/inventory-report" element={<InventoryReport />} />
              <Route path="/warehouse/movements/new" element={<NewStockMovement />} />
              <Route path="/warehouse/movements" element={<StockMovements />} />

              {/* HR */}
              <Route path="/hr/employees" element={<Employees />} />
              <Route path="/hr/additions" element={<AdditionsMaster />} />
              <Route path="/hr/deductions" element={<DeductionsRegistry />} />
              <Route path="/hr/leaves" element={<LeaveManagement />} />
              <Route path="/hr/loans" element={<LoanManagement />} />
              <Route path="/hr/salary-process" element={<SalaryProcess />} />
              <Route path="/hr/payslips/:runId" element={<PaySlips />} />
              <Route path="/hr/payslips" element={<PaySlips />} />
              <Route path="/hr/holidays" element={<HolidayCalendar />} />

              {/* Finance Base Redirect */}
              <Route path="/finance" element={<Navigate to="/finance/accounts" replace />} />
              
              <Route path="/finance/accounts" element={<ChartOfAccounts />} />
              <Route path="/finance/ledger" element={<GeneralLedger />} />
              <Route path="/finance/ledger/:accountId" element={<LedgerDetails />} />
              <Route path="/finance/pnl" element={<ProfitAndLoss />} />
              <Route path="/finance/cashflow" element={<CashFlow />} />
              <Route path="/finance/balancesheet" element={<BalanceSheet />} />
              <Route path="/finance/cashbook" element={<CashBook />} />
              <Route path="/finance/bankbook" element={<BankBook />} />
              <Route path="/finance/journals/new" element={<NewJournalEntry />} />
              <Route path="/finance/journals" element={<JournalEntries />} />
              <Route path="/finance/receipts/new" element={<NewPaymentReceipt />} />
              <Route path="/finance/receipts" element={<PaymentReceipts />} />
              <Route path="/finance/vouchers/new" element={<NewPaymentVoucher />} />
              <Route path="/finance/vouchers" element={<PaymentVouchers />} />
              <Route path="/finance/currencies" element={<Currencies />} />
              <Route path="/finance/tax-groups" element={<TaxGroups />} />
              <Route path="/finance/tax-groups/new" element={<NewTaxGroup />} />
              <Route path="/finance/tax-groups/:id" element={<NewTaxGroup />} />
              <Route path="/finance/vat" element={<VATReport />} />
              <Route path="/finance/reconciliation" element={<BankReconciliation />} />
              
              {/* Settings */}
              <Route path="/settings/users" element={<Users />} />
              <Route path="/settings/roles" element={<Roles />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LayoutProvider>
    </ToastProvider>
  );
}

export default App;
