import prisma from "../../prisma/client.js";
import excelJS from 'exceljs';

export const createOrder = async (req, res) => {
    try {
        const { items, paymentMethod, voucherId } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "Keranjang pesanan tidak boleh kosong" });
        }

        if (!paymentMethod || !['CASH', 'QRIS'].includes(paymentMethod)) {
            return res.status(400).json({ message: "Metode pembayaran tidak valid (Pilih CASH atau QRIS)" });
        }

        const result = await prisma.$transaction(async (tx) => {
            let subtotal = 0;
            let discountAmount = 0;
            const orderDetailsData = [];

            for (const item of items) {
                const menu = await tx.menu.findUnique({
                    where: { id: Number(item.menuId) }
                });

                if (!menu) {
                    throw new Error(`Menu dengan ID ${item.menuId} tidak ditemukan`);
                }
                if (item.qty <= 0) {
                    throw new Error(`Kuantitas untuk menu ${menu.name} tidak valid`);
                }

                const itemTotalPrice = menu.price * item.qty;
                subtotal += itemTotalPrice;

                orderDetailsData.push({
                    menuId: menu.id,
                    qty: Number(item.qty),
                    price: menu.price // Simpan harga saat transaksi terjadi
                });
            }

            // 2. Validasi & Terapkan Voucher (Jika ada)
            if (voucherId) {
                const voucher = await tx.voucher.findUnique({
                    where: { id: Number(voucherId) }
                });

                if (!voucher) throw new Error("Voucher tidak ditemukan");
                if (voucher.isUsed) throw new Error("Voucher ini sudah pernah digunakan");

                const today = new Date();
                if (today < voucher.startDate || today > voucher.endDate) {
                    throw new Error("Voucher tidak aktif atau sudah kadaluarsa");
                }

                discountAmount = voucher.discount;

                // Langsung hanguskan voucher 
                await tx.voucher.update({
                    where: { id: voucher.id },
                    data: { isUsed: true }
                });
            }

            // 3. Kalkulasi Total Akhir
            let totalPrice = subtotal - discountAmount;
            if (totalPrice < 0) totalPrice = 0;

            // 4. Simpan Order & OrderDetail sekaligus
            const newOrder = await tx.order.create({
                data: {
                    subtotal,
                    discount: discountAmount,
                    totalPrice,
                    paymentMethod,
                    voucherId: voucherId ? Number(voucherId) : null,
                    orderDetails: {
                        create: orderDetailsData
                    }
                },
                include: {
                    orderDetails: {
                        include: { menu: true }
                    },
                    voucher: true
                }
            });

            return newOrder;
        });

        res.status(201).json({
            message: "Transaksi berhasil disimpan",
            data: result
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const idsToDelete = req.body.id.map(Number);
        await prisma.order.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        res.json({ message: "Pesanan berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Laporan penjaga
export const getDailyReport = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const dailyOrders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                orderDetails: {
                    include: {
                        menu: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        let totalRevenue = 0;
        let totalItemsSold = 0;

        dailyOrders.forEach(order => {
            totalRevenue += order.totalPrice;

            order.orderDetails.forEach(detail => {
                totalItemsSold += detail.qty;
            });
        });

        res.status(200).json({
            message: "Laporan harian berhasil ditarik",
            data: {
                summary: {
                    totalItemsSold,
                    totalRevenue
                },
                orders: dailyOrders
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Laporan Admin
export const getAllOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                orderDetails: {
                    include: {
                        menu: {
                            select: { name: true }
                        }
                    }
                },
                voucher: {
                    select: { code: true, discount: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            message: "Laporan keseluruhan berhasil ditarik",
            data: orders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getSalesHistory = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Default: Objek kosong (menarik semua data)
        let dateFilter = {};

        // 2. Jika parameter BUKAN 'all', jalankan proses filter tanggal
        if (startDate && startDate !== 'all') {
            if (startDate && endDate) {
                let start = new Date(startDate);
                let end = new Date(endDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);

                dateFilter = {
                    createdAt: {
                        gte: start,
                        lte: end
                    }
                };
            } else if (startDate && !endDate) {
                let start = new Date(startDate);
                let end = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);

                dateFilter = {
                    createdAt: {
                        gte: start,
                        lte: end
                    }
                };
            }
        }
        // Jika startDate === 'all', kode if di atas dilewati, 
        // sehingga dateFilter tetap {} dan Prisma mengambil SEMUA data.

        // 3. Masukkan dateFilter ke dalam query Prisma
        const orders = await prisma.order.findMany({
            where: dateFilter,
            include: {
                orderDetails: {
                    include: {
                        menu: { select: { name: true } }
                    }
                },
                voucher: { select: { code: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        let totalItemsSold = 0;
        let totalRevenue = 0;

        orders.forEach(order => {
            totalRevenue += order.totalPrice;
            order.orderDetails.forEach(detail => {
                totalItemsSold += detail.qty;
            });
        });

        res.status(200).json({
            message: "Riwayat penjualan berhasil ditarik",
            data: {
                summary: {
                    totalItemsSold,
                    totalRevenue
                },
                orders
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const exportSalesToExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Logika Filter Tanggal yang Dinamis
        let dateFilter = {}; // Default: Kosong (Tarik semua data)

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            dateFilter = { createdAt: { gte: start, lte: end } };
        } else if (startDate && !endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(startDate);
            end.setHours(23, 59, 59, 999);

            dateFilter = { createdAt: { gte: start, lte: end } };
        }

        // 2. Tarik Data dari Database
        const orders = await prisma.order.findMany({
            where: dateFilter, // Gunakan objek yang sudah disesuaikan kondisinya
            include: {
                orderDetails: {
                    include: { menu: { select: { name: true } } }
                },
                voucher: { select: { code: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Inisialisasi Workbook Excel
        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet('Riwayat Penjualan');

        // 4. Buat Header Kolom
        worksheet.columns = [
            { header: 'Tanggal & Waktu', key: 'date', width: 25 },
            { header: 'Metode Bayar', key: 'payment', width: 15 },
            { header: 'Detail Pesanan (Qty x Menu)', key: 'items', width: 50 },
            { header: 'Voucher Dipakai', key: 'voucher', width: 20 },
            { header: 'Total Harga (Rp)', key: 'total', width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };

        // 5. Masukkan Data ke Baris Excel
        orders.forEach((order) => {
            const itemsList = order.orderDetails
                .map(detail => `${detail.qty}x ${detail.menu.name}`)
                .join(', ');

            worksheet.addRow({
                date: order.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                payment: order.paymentMethod,
                items: itemsList,
                voucher: order.voucher ? order.voucher.code : '-',
                total: order.totalPrice
            });
        });

        // 6. Penamaan File yang Aman
        let filenameSuffix = "Semua";
        if (startDate && endDate) {
            filenameSuffix = `${startDate}_sampai_${endDate}`;
        } else if (startDate) {
            filenameSuffix = startDate;
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Laporan_Penjualan_${filenameSuffix}.xlsx`
        );

        // 7. Tulis file ke response stream dan kirim ke frontend
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};