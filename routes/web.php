<?php

use App\Http\Controllers\Apps\AuditLogController;
use App\Http\Controllers\Apps\CashierShiftController;
use App\Http\Controllers\Apps\CashierSettlementController;
use App\Http\Controllers\Apps\CategoryController;
use App\Http\Controllers\Apps\CrmCampaignController;
use App\Http\Controllers\Apps\CrmReminderController;
use App\Http\Controllers\Apps\CustomerController;
use App\Http\Controllers\Apps\CustomerSegmentController;
use App\Http\Controllers\Apps\CustomerVoucherController;
use App\Http\Controllers\Apps\DiningTableController;
use App\Http\Controllers\Apps\GoodsReceivingController;
use App\Http\Controllers\Apps\KitchenSettingsController;
use App\Http\Controllers\Apps\KitchenDisplayController;
use App\Http\Controllers\Apps\MemberController;
use App\Http\Controllers\Apps\OperationsGuideController;
use App\Http\Controllers\Apps\OutletManagementController;
use App\Http\Controllers\Apps\PaymentSettingController;
use App\Http\Controllers\Apps\PricingRuleController;
use App\Http\Controllers\Apps\ProductController;
use App\Http\Controllers\Apps\PurchaseOrderController;
use App\Http\Controllers\Apps\SalesReturnController;
use App\Http\Controllers\Apps\StockMutationController;
use App\Http\Controllers\Apps\StockOpnameController;
use App\Http\Controllers\Apps\SupplierReturnController;
use App\Http\Controllers\Apps\TableOrderController;
use App\Http\Controllers\Apps\TransactionController;
use App\Http\Controllers\Apps\WaiterBoardController;
use App\Http\Controllers\Apps\WorkspaceSalesController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OutletContextController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicTableOrderController;
use App\Http\Controllers\Reports\AdvancedSalesInsightsController;
use App\Http\Controllers\Reports\OutletAnalyticsController;
use App\Http\Controllers\Reports\ProfitReportController;
use App\Http\Controllers\Reports\SalesReportController;
use App\Http\Controllers\Reports\SetupAuditController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return redirect()->route('login');
});

Route::get('/kitchen-entry/{stationSlug}', [KitchenDisplayController::class, 'entry'])
    ->name('kitchen.entry');

Route::get('/dashboard/access', function () {
    return Inertia::render('Dashboard/Access');
})->middleware(['auth'])->name('dashboard.access');

// Public share routes (no login)
Route::get('/share/transactions/{invoice}', [\App\Http\Controllers\DocumentController::class, 'publicInvoice'])
    ->name('transactions.public');
Route::get('/order/table/{qrToken}', [PublicTableOrderController::class, 'show'])
    ->name('table-order.show');
Route::post('/order/table/{qrToken}/identify', [PublicTableOrderController::class, 'identify'])
    ->name('table-order.identify');
Route::post('/order/table/{qrToken}/register-identity', [PublicTableOrderController::class, 'registerIdentity'])
    ->name('table-order.register-identity');
Route::post('/order/table/{qrToken}/logout', [PublicTableOrderController::class, 'logout'])
    ->name('table-order.logout');
Route::post('/order/table/{qrToken}', [PublicTableOrderController::class, 'store'])
    ->name('table-order.store');
Route::get('/order/status/{accessToken}', [PublicTableOrderController::class, 'status'])
    ->name('table-order.status');

Route::group(['prefix' => 'dashboard', 'middleware' => ['auth']], function () {
    Route::get('/', [DashboardController::class, 'index'])->middleware(['auth', 'permission:dashboard-access'])->name('dashboard');
    Route::post('/outlet-context', [OutletContextController::class, 'update'])->name('outlets.switch');
    Route::get('/permissions', [PermissionController::class, 'index'])->middleware('permission:permissions-access')->name('permissions.index');
    Route::get('/guides/outlet-kitchen', [OperationsGuideController::class, 'outletKitchen'])->middleware('permission:dashboard-access')->name('guides.outlet-kitchen');
    Route::get('/guides/setup-wizard', [OperationsGuideController::class, 'setupWizard'])->middleware('permission:dashboard-access')->name('guides.setup-wizard');
    Route::get('/guides/pwa-setup', [OperationsGuideController::class, 'pwaSetup'])->middleware('permission:dashboard-access')->name('guides.pwa-setup');
    // roles route
    Route::resource('/roles', RoleController::class)
        ->except(['create', 'edit', 'show'])
        ->middlewareFor('index', 'permission:roles-access')
        ->middlewareFor('store', ['permission:roles-create', 'step_up'])
        ->middlewareFor('update', ['permission:roles-update', 'step_up'])
        ->middlewareFor('destroy', ['permission:roles-delete', 'step_up']);
    // users route
    Route::resource('/users', UserController::class)
        ->except('show')
        ->middlewareFor('index', 'permission:users-access')
        ->middlewareFor(['create', 'store'], 'permission:users-create')
        ->middlewareFor('store', ['permission:users-create', 'step_up'])
        ->middlewareFor(['edit', 'update'], 'permission:users-update')
        ->middlewareFor('update', ['permission:users-update', 'step_up'])
        ->middlewareFor('destroy', ['permission:users-delete', 'step_up']);
    Route::post('/notifications/low-stock/read', [NotificationController::class, 'markLowStockRead'])->name('notifications.stock.read');
    Route::post('/notifications/low-stock/read-all', [NotificationController::class, 'markAllLowStockRead'])->name('notifications.stock.readAll');
    Route::get('/regions/regencies', [\App\Http\Controllers\RegionController::class, 'regencies'])->name('regions.regencies');
    Route::get('/regions/districts', [\App\Http\Controllers\RegionController::class, 'districts'])->name('regions.districts');
    Route::get('/regions/villages', [\App\Http\Controllers\RegionController::class, 'villages'])->name('regions.villages');

    Route::resource('categories', CategoryController::class)
        ->middlewareFor(['index', 'show'], 'permission:categories-access')
        ->middlewareFor(['create', 'store'], 'permission:categories-create')
        ->middlewareFor(['edit', 'update'], 'permission:categories-edit')
        ->middlewareFor('destroy', 'permission:categories-delete');
    Route::resource('products', ProductController::class)
        ->middlewareFor(['index', 'show'], 'permission:products-access')
        ->middlewareFor(['create', 'store'], 'permission:products-create')
        ->middlewareFor(['edit', 'update'], 'permission:products-edit')
        ->middlewareFor('destroy', 'permission:products-delete');
    Route::resource('dining-tables', DiningTableController::class)
        ->except(['show', 'create', 'edit'])
        ->middlewareFor('index', 'permission:dining-tables-access')
        ->middlewareFor('store', ['permission:dining-tables-create', 'outlet_access'])
        ->middlewareFor('update', ['permission:dining-tables-update', 'outlet_access'])
        ->middlewareFor('destroy', ['permission:dining-tables-delete', 'outlet_access']);
    Route::get('dining-tables/{diningTable}/print', [DiningTableController::class, 'print'])
        ->middleware(['permission:dining-tables-access', 'outlet_access'])
        ->name('dining-tables.print');
    Route::get('table-orders', [TableOrderController::class, 'index'])
        ->middleware('permission:table-orders-access')
        ->name('table-orders.index');
    Route::post('table-orders/{tableOrder}/approve', [TableOrderController::class, 'approve'])
        ->middleware(['permission:table-orders-approve', 'outlet_access'])
        ->name('table-orders.approve');
    Route::post('table-orders/{tableOrder}/cancel', [TableOrderController::class, 'cancel'])
        ->middleware(['permission:table-orders-approve', 'outlet_access'])
        ->name('table-orders.cancel');
    Route::get('products-menu-book', [ProductController::class, 'menuBook'])
        ->middleware('permission:products-access')
        ->name('products.menu-book');
    Route::post('products/bulk-mapping', [ProductController::class, 'bulkMapping'])
        ->middleware(['permission:products-edit', 'step_up'])
        ->name('products.bulk-mapping');
    Route::patch('products/{product}/daily-stock', [ProductController::class, 'updateDailyStock'])
        ->middleware('permission:products-edit')
        ->name('products.daily-stock.update');
    Route::patch('products/{product}/outlet-stocks', [ProductController::class, 'updateOutletStocks'])
        ->middleware(['permission:products-edit', 'step_up'])
        ->name('products.outlet-stocks.update');
    Route::resource('pricing-rules', PricingRuleController::class)
        ->except(['show'])
        ->middlewareFor('index', 'permission:pricing-rules-access')
        ->middlewareFor(['create', 'store'], 'permission:pricing-rules-create')
        ->middlewareFor(['edit', 'update'], 'permission:pricing-rules-update')
        ->middlewareFor('destroy', 'permission:pricing-rules-delete');
    Route::post('pricing-rules/preview', [PricingRuleController::class, 'preview'])
        ->middleware('permission:pricing-rules-access')
        ->name('pricing-rules.preview');
    Route::get('outlets', [OutletManagementController::class, 'index'])->middleware('permission:outlets-access')->name('outlets.index');
    Route::get('outlets/{outlet}', [OutletManagementController::class, 'show'])->middleware(['permission:outlets-access', 'outlet_access'])->name('outlets.show');
    Route::post('outlets', [OutletManagementController::class, 'store'])->middleware(['permission:outlets-create', 'step_up'])->name('outlets.store');
    Route::put('outlets/{outlet}', [OutletManagementController::class, 'update'])->middleware(['permission:outlets-update', 'step_up', 'outlet_access'])->name('outlets.update');
    Route::patch('outlets/{outlet}/toggle', [OutletManagementController::class, 'toggle'])->middleware(['permission:outlets-toggle', 'step_up', 'outlet_access'])->name('outlets.toggle');
    Route::get('stock-opnames', [StockOpnameController::class, 'index'])->middleware('permission:stock-opnames-access')->name('stock-opnames.index');
    Route::get('stock-opnames/create', [StockOpnameController::class, 'create'])->middleware('permission:stock-opnames-create')->name('stock-opnames.create');
    Route::post('stock-opnames', [StockOpnameController::class, 'store'])->middleware('permission:stock-opnames-create')->name('stock-opnames.store');
    Route::get('stock-opnames/{stockOpname}', [StockOpnameController::class, 'show'])->middleware('permission:stock-opnames-access')->name('stock-opnames.show');
    Route::patch('stock-opnames/{stockOpname}', [StockOpnameController::class, 'update'])->middleware('permission:stock-opnames-create')->name('stock-opnames.update');
    Route::post('stock-opnames/{stockOpname}/items', [StockOpnameController::class, 'storeItem'])->middleware('permission:stock-opnames-create')->name('stock-opnames.items.store');
    Route::patch('stock-opnames/{stockOpname}/items/{item}', [StockOpnameController::class, 'updateItem'])->middleware('permission:stock-opnames-create')->name('stock-opnames.items.update');
    Route::post('stock-opnames/{stockOpname}/finalize', [StockOpnameController::class, 'finalize'])->middleware('permission:stock-opnames-finalize')->name('stock-opnames.finalize');
    Route::get('stock-mutations', [StockMutationController::class, 'index'])->middleware('permission:stock-mutations-access')->name('stock-mutations.index');
    Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:audit-logs-access')->name('audit-logs.index');
    Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show'])->middleware('permission:audit-logs-access')->name('audit-logs.show');
    Route::get('cashier-shifts', [CashierShiftController::class, 'index'])->middleware('permission:cashier-shifts-access')->name('cashier-shifts.index');
    Route::post('cashier-shifts', [CashierShiftController::class, 'store'])->middleware('permission:cashier-shifts-open')->name('cashier-shifts.store');
    Route::get('cashier-shifts/{cashierShift}', [CashierShiftController::class, 'show'])->middleware('permission:cashier-shifts-access')->name('cashier-shifts.show');
    Route::post('cashier-shifts/{cashierShift}/close', [CashierShiftController::class, 'close'])->middleware('permission:cashier-shifts-close')->name('cashier-shifts.close');
    Route::get('cashier-settlements', [CashierSettlementController::class, 'index'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('cashier-settlements.index');
    Route::post('cashier-settlements', [CashierSettlementController::class, 'store'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('cashier-settlements.store');
    Route::patch('cashier-settlements/{cashierSettlement}/approve', [CashierSettlementController::class, 'approve'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('cashier-settlements.approve');
    Route::patch('cashier-settlements/{cashierSettlement}/reject', [CashierSettlementController::class, 'reject'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('cashier-settlements.reject');
    Route::get('cashier-settlements/{cashierSettlement}/receipt', [CashierSettlementController::class, 'receipt'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('cashier-settlements.receipt');
    Route::resource('customers', CustomerController::class)
        ->middlewareFor(['index', 'show'], 'permission:customers-access')
        ->middlewareFor(['create', 'store'], 'permission:customers-create')
        ->middlewareFor(['edit', 'update'], 'permission:customers-edit')
        ->middlewareFor('destroy', 'permission:customers-delete');
    Route::resource('members', MemberController::class)
        ->parameters(['members' => 'member'])
        ->except(['destroy'])
        ->middlewareFor(['index', 'show'], 'permission:customers-access')
        ->middlewareFor(['create', 'store'], 'permission:customers-create')
        ->middlewareFor(['edit', 'update'], 'permission:customers-edit');
    Route::resource('customer-vouchers', CustomerVoucherController::class)
        ->except(['show'])
        ->middlewareFor('index', 'permission:customer-vouchers-access')
        ->middlewareFor(['create', 'store'], 'permission:customer-vouchers-create')
        ->middlewareFor(['edit', 'update'], 'permission:customer-vouchers-update')
        ->middlewareFor('destroy', 'permission:customer-vouchers-delete');
    Route::resource('customer-segments', CustomerSegmentController::class)
        ->middlewareFor(['index', 'show'], 'permission:customer-segments-access')
        ->middlewareFor(['create', 'store'], 'permission:customer-segments-create')
        ->middlewareFor(['edit', 'update'], 'permission:customer-segments-update')
        ->middlewareFor('destroy', 'permission:customer-segments-delete');
    Route::post('customer-segments/{customerSegment}/members', [CustomerSegmentController::class, 'storeMember'])
        ->middleware('permission:customer-segments-update')
        ->name('customer-segments.members.store');
    Route::delete('customer-segments/{customerSegment}/members/{customer}', [CustomerSegmentController::class, 'destroyMember'])
        ->middleware('permission:customer-segments-update')
        ->name('customer-segments.members.destroy');
    Route::resource('crm-campaigns', CrmCampaignController::class)
        ->middlewareFor(['index', 'show'], 'permission:crm-campaigns-access')
        ->middlewareFor(['create', 'store'], 'permission:crm-campaigns-create')
        ->middlewareFor(['edit', 'update'], 'permission:crm-campaigns-update')
        ->middlewareFor('destroy', 'permission:crm-campaigns-delete');
    Route::post('crm-campaigns/{crmCampaign}/process', [CrmCampaignController::class, 'process'])
        ->middleware('permission:crm-campaigns-update')
        ->name('crm-campaigns.process');
    Route::post('crm-campaigns/{crmCampaign}/cancel', [CrmCampaignController::class, 'cancel'])
        ->middleware('permission:crm-campaigns-update')
        ->name('crm-campaigns.cancel');
    Route::post('crm-campaign-logs/{log}/mark-sent', [CrmCampaignController::class, 'markLogSent'])
        ->middleware('permission:crm-campaigns-update')
        ->name('crm-campaign-logs.mark-sent');
    Route::post('crm-campaign-logs/{log}/skip', [CrmCampaignController::class, 'markLogSkipped'])
        ->middleware('permission:crm-campaigns-update')
        ->name('crm-campaign-logs.skip');
    Route::get('crm-reminders', [CrmReminderController::class, 'index'])
        ->middleware('permission:crm-reminders-access')
        ->name('crm-reminders.index');
    Route::get('workspace-sales', [WorkspaceSalesController::class, 'index'])
        ->middleware(['permission:dashboard-access', 'outlet_access'])
        ->name('workspace-sales.index');

    // route customer history
    Route::get('/customers/{customer}/history', [CustomerController::class, 'getHistory'])->middleware('permission:transactions-access')->name('customers.history');
    Route::put('/customers/{customer}/segments', [CustomerController::class, 'syncSegments'])->middleware('permission:customers-edit')->name('customers.segments.sync');
    Route::match(['post', 'put'], '/customers/{customer}/upgrade-member', [CustomerController::class, 'upgradeToMember'])
        ->middleware('permission:customers-edit')
        ->name('customers.upgrade-member');

    // route customer store via AJAX (no redirect)
    Route::post('/customers/store-ajax', [CustomerController::class, 'storeAjax'])->middleware('permission:customers-create')->name('customers.storeAjax');

    // route transaction
    Route::get('/transactions', [TransactionController::class, 'index'])->middleware('permission:transactions-access')->name('transactions.index');

    // route transaction searchProduct
    Route::post('/transactions/searchProduct', [TransactionController::class, 'searchProduct'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.searchProduct');

    // route transaction addToCart
    Route::post('/transactions/addToCart', [TransactionController::class, 'addToCart'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.addToCart');

    // route transaction destroyCart
    Route::delete('/transactions/{cart_id}/destroyCart', [TransactionController::class, 'destroyCart'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.destroyCart');

    // route transaction updateCart
    Route::patch('/transactions/{cart_id}/updateCart', [TransactionController::class, 'updateCart'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.updateCart');
    Route::patch('/transactions/{cart_id}/notes', [TransactionController::class, 'updateCartNotes'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.updateCartNotes');
    Route::post('/transactions/{cart_id}/modifiers', [TransactionController::class, 'storeCartModifier'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.storeCartModifier');
    Route::patch('/transactions/{cart_id}/modifiers/{modifier}', [TransactionController::class, 'updateCartModifier'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.updateCartModifier');
    Route::delete('/transactions/{cart_id}/modifiers/{modifier}', [TransactionController::class, 'destroyCartModifier'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.destroyCartModifier');
    Route::patch('/transactions/{cart_id}/tenant', [TransactionController::class, 'updateCartTenant'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.updateCartTenant');
    Route::post('/transactions/pricing-preview', [TransactionController::class, 'previewPricing'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.pricing-preview');

    // route hold transaction
    Route::post('/transactions/hold', [TransactionController::class, 'holdCart'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.hold');
    Route::post('/transactions/{holdId}/resume', [TransactionController::class, 'resumeCart'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.resume');
    Route::delete('/transactions/{holdId}/clearHold', [TransactionController::class, 'clearHold'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.clearHold');
    Route::get('/transactions/held', [TransactionController::class, 'getHeldCarts'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.held');

    // route transaction store
    Route::post('/transactions/store', [TransactionController::class, 'store'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.store');
    Route::get('/transactions/health', [TransactionController::class, 'health'])->middleware('permission:transactions-access')->name('transactions.health');
    Route::post('/transactions/sync-offline', [TransactionController::class, 'syncOffline'])->middleware(['permission:transactions-access', 'active_shift'])->name('transactions.sync-offline');
    Route::get('/transactions/{invoice}/print', [TransactionController::class, 'print'])->middleware('permission:transactions-access')->name('transactions.print');
    Route::get('/transactions/history', [TransactionController::class, 'history'])->middleware('permission:transactions-access')->name('transactions.history');
    Route::get('/kitchen', [KitchenDisplayController::class, 'index'])->middleware('permission:dashboard-access')->name('kitchen.index');
    Route::get('/kitchen/{stationSlug}', [KitchenDisplayController::class, 'show'])->middleware('permission:dashboard-access')->name('kitchen.show');
    Route::get('/kitchen/{stationSlug}/feed', [KitchenDisplayController::class, 'feed'])->middleware('permission:dashboard-access')->name('kitchen.feed');
    Route::post('/kitchen/tickets/{kitchenTicket}/dispatch', [KitchenDisplayController::class, 'dispatch'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.dispatch');
    Route::post('/kitchen/tickets/{kitchenTicket}/queue-dispatch', [KitchenDisplayController::class, 'queueDispatch'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.queue-dispatch');
    Route::post('/kitchen/tickets/{kitchenTicket}/fail-dispatch', [KitchenDisplayController::class, 'failDispatch'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.fail-dispatch');
    Route::post('/kitchen/tickets/{kitchenTicket}/acknowledge', [KitchenDisplayController::class, 'acknowledge'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.acknowledge');
    Route::post('/kitchen/tickets/{kitchenTicket}/complete', [KitchenDisplayController::class, 'complete'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.complete');
    Route::post('/kitchen/tickets/{kitchenTicket}/deliver', [KitchenDisplayController::class, 'deliver'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('kitchen.tickets.deliver');
    Route::post('/transactions/{transaction}/share-campaign', [CrmCampaignController::class, 'shareTransaction'])->middleware(['permission:crm-campaigns-create', 'outlet_access'])->name('transactions.share-campaign');
    Route::get('/transactions/history/{transaction}/sales-return/create', [SalesReturnController::class, 'create'])->middleware(['permission:sales-returns-create', 'outlet_access'])->name('sales-returns.create');
    Route::post('/transactions/history/{transaction}/sales-return', [SalesReturnController::class, 'store'])->middleware(['permission:sales-returns-create', 'outlet_access'])->name('sales-returns.store');
    Route::get('/sales-returns', [SalesReturnController::class, 'index'])->middleware('permission:sales-returns-access')->name('sales-returns.index');
    Route::get('/sales-returns/{salesReturn}', [SalesReturnController::class, 'show'])->middleware(['permission:sales-returns-access', 'outlet_access'])->name('sales-returns.show');
    Route::patch('/sales-returns/{salesReturn}', [SalesReturnController::class, 'update'])->middleware(['permission:sales-returns-create', 'outlet_access'])->name('sales-returns.update');
    Route::post('/sales-returns/{salesReturn}/complete', [SalesReturnController::class, 'complete'])->middleware(['permission:sales-returns-complete', 'outlet_access'])->name('sales-returns.complete');
    // route purchase orders
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('permission:purchase-orders-access')->name('purchase-orders.index');
    Route::get('/purchase-orders/create', [PurchaseOrderController::class, 'create'])->middleware('permission:purchase-orders-create')->name('purchase-orders.create');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('permission:purchase-orders-create')->name('purchase-orders.store');
    Route::get('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->middleware(['permission:purchase-orders-access', 'outlet_access'])->name('purchase-orders.show');
    Route::post('/purchase-orders/{purchaseOrder}/place', [PurchaseOrderController::class, 'placeOrder'])->middleware(['permission:purchase-orders-update', 'outlet_access'])->name('purchase-orders.place');
    Route::post('/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware(['permission:purchase-orders-update', 'outlet_access'])->name('purchase-orders.cancel');

    // route goods receivings
    Route::get('/goods-receivings', [GoodsReceivingController::class, 'index'])->middleware('permission:goods-receivings-access')->name('goods-receivings.index');
    Route::get('/goods-receivings/create', [GoodsReceivingController::class, 'create'])->middleware('permission:goods-receivings-create')->name('goods-receivings.create');
    Route::post('/goods-receivings', [GoodsReceivingController::class, 'store'])->middleware('permission:goods-receivings-create')->name('goods-receivings.store');
    Route::get('/goods-receivings/{goodsReceiving}', [GoodsReceivingController::class, 'show'])->middleware(['permission:goods-receivings-access', 'outlet_access'])->name('goods-receivings.show');

    // route supplier returns
    Route::get('/supplier-returns', [SupplierReturnController::class, 'index'])->middleware('permission:supplier-returns-access')->name('supplier-returns.index');
    Route::get('/supplier-returns/create', [SupplierReturnController::class, 'create'])->middleware('permission:supplier-returns-create')->name('supplier-returns.create');
    Route::post('/supplier-returns', [SupplierReturnController::class, 'store'])->middleware('permission:supplier-returns-create')->name('supplier-returns.store');
    Route::get('/supplier-returns/{supplierReturn}', [SupplierReturnController::class, 'show'])->middleware(['permission:supplier-returns-access', 'outlet_access'])->name('supplier-returns.show');
    Route::post('/supplier-returns/{supplierReturn}/complete', [SupplierReturnController::class, 'complete'])->middleware(['permission:supplier-returns-update', 'outlet_access'])->name('supplier-returns.complete');
    Route::post('/supplier-returns/{supplierReturn}/cancel', [SupplierReturnController::class, 'cancel'])->middleware(['permission:supplier-returns-update', 'outlet_access'])->name('supplier-returns.cancel');

    // receivables (nota barang)
    Route::get('/receivables', [\App\Http\Controllers\Apps\ReceivableController::class, 'index'])->middleware('permission:receivables-access')->name('receivables.index');
    Route::get('/receivables/aging', [\App\Http\Controllers\Apps\ReceivableController::class, 'aging'])->middleware('permission:receivables-access')->name('receivables.aging');
    Route::get('/receivables/customer-statement', [\App\Http\Controllers\Apps\ReceivableController::class, 'customerStatement'])->middleware('permission:receivables-access')->name('receivables.customer-statement');
    Route::get('/receivables/{receivable}', [\App\Http\Controllers\Apps\ReceivableController::class, 'show'])->middleware(['permission:receivables-access', 'outlet_access'])->name('receivables.show');
    Route::patch('/receivables/{receivable}/collection-notes', [\App\Http\Controllers\Apps\ReceivableController::class, 'updateCollectionNotes'])->middleware(['permission:receivables-access', 'outlet_access'])->name('receivables.collection-notes');
    Route::post('/receivables/{receivable}/pay', [\App\Http\Controllers\Apps\ReceivableController::class, 'pay'])->middleware(['permission:receivables-pay', 'outlet_access'])->name('receivables.pay');
    Route::post('/receivables/{receivable}/share-campaign', [CrmCampaignController::class, 'shareReceivable'])->middleware(['permission:crm-campaigns-create', 'outlet_access'])->name('receivables.share-campaign');
    // suppliers & payables
    Route::get('/suppliers', [\App\Http\Controllers\Apps\SupplierController::class, 'index'])->middleware('permission:suppliers-access')->name('suppliers.index');
    Route::post('/suppliers', [\App\Http\Controllers\Apps\SupplierController::class, 'store'])->middleware('permission:suppliers-access')->name('suppliers.store');
    Route::put('/suppliers/{supplier}', [\App\Http\Controllers\Apps\SupplierController::class, 'update'])->middleware('permission:suppliers-access')->name('suppliers.update');
    Route::delete('/suppliers/{supplier}', [\App\Http\Controllers\Apps\SupplierController::class, 'destroy'])->middleware('permission:suppliers-access')->name('suppliers.destroy');
    Route::get('/payables', [\App\Http\Controllers\Apps\PayableController::class, 'index'])->middleware('permission:payables-access')->name('payables.index');
    Route::post('/payables', [\App\Http\Controllers\Apps\PayableController::class, 'store'])->middleware('permission:payables-access')->name('payables.store');
    Route::get('/payables/supplier-statement', [\App\Http\Controllers\Apps\PayableController::class, 'supplierStatement'])->middleware('permission:payables-access')->name('payables.supplier-statement');
    Route::get('/payables/{payable}', [\App\Http\Controllers\Apps\PayableController::class, 'show'])->middleware(['permission:payables-access', 'outlet_access'])->name('payables.show');
    Route::post('/payables/{payable}/pay', [\App\Http\Controllers\Apps\PayableController::class, 'pay'])->middleware(['permission:payables-pay', 'outlet_access'])->name('payables.pay');

    // pdf documents
    Route::get('/documents/transactions/{invoice}/pdf/invoice', [\App\Http\Controllers\DocumentController::class, 'invoice'])->middleware('permission:transactions-access')->name('pdf.transactions.invoice');
    Route::get('/documents/transactions/{invoice}/pdf/receipt/{size?}', [\App\Http\Controllers\DocumentController::class, 'receipt'])->middleware('permission:transactions-access')->name('pdf.transactions.receipt');
    Route::get('/documents/transactions/{invoice}/pdf/shipping', [\App\Http\Controllers\DocumentController::class, 'shipping'])->middleware('permission:transactions-access')->name('pdf.transactions.shipping');
    Route::get('/documents/products/menu-book/pdf', [\App\Http\Controllers\DocumentController::class, 'menuBook'])->middleware('permission:products-access')->name('pdf.products.menu-book');
    Route::get('/documents/receivables/{receivable}/pdf', [\App\Http\Controllers\DocumentController::class, 'receivable'])->middleware(['permission:receivables-access', 'outlet_access'])->name('pdf.receivables.show');
    Route::get('/documents/payables/{payable}/pdf', [\App\Http\Controllers\DocumentController::class, 'payable'])->middleware(['permission:payables-access', 'outlet_access'])->name('pdf.payables.show');

    Route::get('/settings/payments', [PaymentSettingController::class, 'edit'])->middleware('permission:payment-settings-access')->name('settings.payments.edit');
    Route::put('/settings/payments', [PaymentSettingController::class, 'update'])->middleware(['permission:payment-settings-update', 'step_up'])->name('settings.payments.update');

    // settings target penjualan
    Route::get('/settings/target', [\App\Http\Controllers\Apps\SettingController::class, 'target'])->middleware('permission:dashboard-access')->name('settings.target');
    Route::post('/settings/target', [\App\Http\Controllers\Apps\SettingController::class, 'updateTarget'])->middleware('permission:dashboard-access')->name('settings.target.update');
    Route::get('/settings/store', [\App\Http\Controllers\Apps\SettingController::class, 'storeProfile'])->middleware('permission:dashboard-access')->name('settings.store');
    Route::post('/settings/store', [\App\Http\Controllers\Apps\SettingController::class, 'updateStoreProfile'])->middleware('permission:dashboard-access')->name('settings.store.update');
    Route::get('/settings/kitchen-devices', [KitchenSettingsController::class, 'index'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('settings.kitchen-devices.index');
    Route::post('/settings/kitchen-operations', [KitchenSettingsController::class, 'updateOperational'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('settings.kitchen-operations.update');
    Route::get('/settings/kitchen-stations/{station}/access-sheet', [KitchenSettingsController::class, 'accessSheet'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('settings.kitchen-stations.access-sheet');
    Route::post('/settings/kitchen-stations', [KitchenSettingsController::class, 'storeStation'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-stations.store');
    Route::put('/settings/kitchen-stations/{station}', [KitchenSettingsController::class, 'updateStation'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-stations.update');
    Route::patch('/settings/kitchen-stations/{station}/processing-mode', [KitchenSettingsController::class, 'updateStationProcessingMode'])->middleware(['permission:dashboard-access', 'outlet_access'])->name('settings.kitchen-stations.processing-mode.update');
    Route::post('/settings/kitchen-stations/{station}/devices', [KitchenSettingsController::class, 'storeDevice'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-devices.store');
    Route::put('/settings/kitchen-devices/{device}', [KitchenSettingsController::class, 'updateDevice'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-devices.update');
    Route::patch('/settings/kitchen-devices/{device}/toggle', [KitchenSettingsController::class, 'toggleDevice'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-devices.toggle');
    Route::post('/settings/kitchen-devices/{device}/test', [KitchenSettingsController::class, 'testDevice'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-devices.test');
    Route::post('/settings/kitchen-devices/{device}/health-check', [KitchenSettingsController::class, 'healthCheckDevice'])->middleware(['permission:dashboard-access', 'step_up', 'outlet_access'])->name('settings.kitchen-devices.health-check');
    Route::get('/settings/loyalty', [\App\Http\Controllers\Apps\SettingController::class, 'loyalty'])->middleware('permission:dashboard-access')->name('settings.loyalty');
    Route::post('/settings/loyalty', [\App\Http\Controllers\Apps\SettingController::class, 'updateLoyalty'])->middleware('permission:dashboard-access')->name('settings.loyalty.update');

    // settings bank accounts
    Route::get('/settings/bank-accounts', [\App\Http\Controllers\Apps\BankAccountController::class, 'index'])->middleware('permission:payment-settings-access')->name('settings.bank-accounts.index');
    Route::get('/settings/bank-accounts/create', [\App\Http\Controllers\Apps\BankAccountController::class, 'create'])->middleware('permission:payment-settings-update')->name('settings.bank-accounts.create');
    Route::post('/settings/bank-accounts', [\App\Http\Controllers\Apps\BankAccountController::class, 'store'])->middleware(['permission:payment-settings-update', 'step_up'])->name('settings.bank-accounts.store');
    Route::get('/settings/bank-accounts/{bankAccount}/edit', [\App\Http\Controllers\Apps\BankAccountController::class, 'edit'])->middleware(['permission:payment-settings-update', 'outlet_access'])->name('settings.bank-accounts.edit');
    Route::put('/settings/bank-accounts/{bankAccount}', [\App\Http\Controllers\Apps\BankAccountController::class, 'update'])->middleware(['permission:payment-settings-update', 'step_up', 'outlet_access'])->name('settings.bank-accounts.update');
    Route::delete('/settings/bank-accounts/{bankAccount}', [\App\Http\Controllers\Apps\BankAccountController::class, 'destroy'])->middleware(['permission:payment-settings-update', 'step_up', 'outlet_access'])->name('settings.bank-accounts.destroy');
    Route::patch('/settings/bank-accounts/{bankAccount}/toggle', [\App\Http\Controllers\Apps\BankAccountController::class, 'toggleActive'])->middleware(['permission:payment-settings-update', 'step_up', 'outlet_access'])->name('settings.bank-accounts.toggle');
    Route::post('/settings/bank-accounts/order', [\App\Http\Controllers\Apps\BankAccountController::class, 'updateOrder'])->middleware(['permission:payment-settings-update', 'step_up'])->name('settings.bank-accounts.order');

    // confirm payment for bank transfer
    Route::patch('/transactions/{transaction}/confirm-payment', [TransactionController::class, 'confirmPayment'])->middleware(['permission:transactions-confirm-payment', 'step_up', 'outlet_access'])->name('transactions.confirm-payment');
    Route::get('/waiter-board', [WaiterBoardController::class, 'index'])->middleware(['permission:waiter-board-access', 'outlet_access'])->name('waiter-board.index');
    Route::post('/waiter-board/{allocation}/assign', [WaiterBoardController::class, 'assign'])->middleware(['permission:waiter-board-access', 'outlet_access'])->name('waiter-board.assign');
    Route::post('/waiter-board/{allocation}/pick-up', [WaiterBoardController::class, 'pickUp'])->middleware(['permission:waiter-board-access', 'outlet_access'])->name('waiter-board.pick-up');
    Route::post('/waiter-board/{allocation}/deliver', [WaiterBoardController::class, 'deliver'])->middleware(['permission:waiter-board-access', 'outlet_access'])->name('waiter-board.deliver');

    // reports
    Route::get('/reports/sales', [SalesReportController::class, 'index'])->middleware('permission:reports-access')->name('reports.sales.index');
    Route::get('/reports/sales/tenant-statement/{tenantOutlet}', [SalesReportController::class, 'tenantStatement'])->middleware(['permission:reports-access', 'outlet_access'])->name('reports.sales.tenant-statement');
    Route::get('/reports/sales/tenant-settlement/export', [SalesReportController::class, 'exportTenantSettlement'])->middleware('permission:reports-access')->name('reports.sales.tenant-settlement.export');
    Route::get('/reports/sales/tenant-settlement/print', [SalesReportController::class, 'printTenantSettlementBatch'])->middleware('permission:reports-access')->name('reports.sales.tenant-settlement.print');
    Route::get('/reports/sales/tenant-statement/{tenantOutlet}/export', [SalesReportController::class, 'exportTenantStatement'])->middleware(['permission:reports-access', 'outlet_access'])->name('reports.sales.tenant-statement.export');
    Route::patch('/reports/sales/tenant-allocations/{allocation}/settle', [SalesReportController::class, 'settleTenantAllocation'])->middleware(['permission:reports-access', 'step_up', 'outlet_access'])->name('reports.sales.tenant-allocations.settle');
    Route::patch('/reports/sales/tenant-allocations/{allocation}/unsettle', [SalesReportController::class, 'unsettleTenantAllocation'])->middleware(['permission:reports-access', 'step_up', 'outlet_access'])->name('reports.sales.tenant-allocations.unsettle');
    Route::get('/reports/sales/tenant-allocations/{allocation}/receipt', [SalesReportController::class, 'printTenantAllocationReceipt'])->middleware(['permission:reports-access', 'outlet_access'])->name('reports.sales.tenant-allocations.receipt');
    Route::get('/reports/outlet-analytics', [OutletAnalyticsController::class, 'index'])->middleware(['permission:reports-access', 'outlet_access'])->name('reports.outlet-analytics.index');
    Route::get('/reports/setup-audit', [SetupAuditController::class, 'index'])->middleware('permission:reports-access')->name('reports.setup-audit.index');
    Route::get('/reports/profits', [ProfitReportController::class, 'index'])->middleware('permission:profits-access')->name('reports.profits.index');
    Route::get('/reports/insights', [AdvancedSalesInsightsController::class, 'index'])->middleware('permission:reports-access')->name('reports.insights.index');

    // aging & reminders
    Route::get('/aging', [\App\Http\Controllers\Apps\AgingController::class, 'index'])->middleware('permission:receivables-access')->name('aging.index');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
