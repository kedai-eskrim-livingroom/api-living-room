import { Router } from "express";
import multer from 'multer';
import * as authController from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';
import * as menuController from '../controllers/menus.controller.js';
import * as voucherController from '../controllers/vouchers.controller.js';
import * as orderController from '../controllers/orders.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as accountController from '../controllers/account.controller.js';

const route = Router();
const upload = multer({ storage: multer.memoryStorage() });


// Auth Route
route.post('/login', authController.login);

// Dashboard
route.get('/dashboard', auth, authorize("ADMIN"), dashboardController.getDashboardData);

// Riwayat
route.get('/orders/export', auth, authorize("ADMIN"), orderController.exportSalesToExcel);
route.get('/orders/history', auth, authorize("ADMIN"), orderController.getSalesHistory);

// Akun
route.get('/accounts', auth, authorize("ADMIN"), accountController.getAccounts);
route.post('/accounts', auth, authorize("ADMIN"), accountController.createAccount);
route.put('/accounts/:id', auth, authorize("ADMIN"), accountController.updateAccount);
route.delete('/accounts', auth, authorize("ADMIN"), accountController.deleteAccount);

// Menu Route
route.get('/menus', auth, authorize("ADMIN", "PENJAGA"), menuController.getMenu);
route.post('/menus', auth, authorize("ADMIN"), upload.single("photo"), menuController.createMenu);
route.put('/menus/:id', auth, authorize("ADMIN"), upload.single("photo"), menuController.updateMenu);
route.delete('/menus', auth, authorize("ADMIN"), menuController.deleteMenu);

// Voucher Route
route.get('/vouchers', auth, authorize("ADMIN"), voucherController.getVouchers);
route.post('/vouchers', auth, authorize("ADMIN"), voucherController.createVoucher);
route.put('/vouchers/:id', auth, authorize("ADMIN"), voucherController.updateVoucher);
route.delete('/vouchers', auth, authorize("ADMIN"), voucherController.deleteVoucher);

// Validasi voucher sebelum membuat pesanan
route.post('/vouchers/validate', auth, authorize("PENJAGA"), voucherController.validateVoucher);

// Buat pesanan baru
route.post('/orders', auth, authorize("PENJAGA"), orderController.createOrder);

// Laporan Harian (Akses: PENJAGA)
route.get('/orders/daily', auth, authorize("PENJAGA"), orderController.getDailyReport);



export default route;