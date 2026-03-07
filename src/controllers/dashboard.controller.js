import prisma from "../../prisma/client.js";

export const getDashboardData = async (req, res) => {
    try {
        // params 
        const { startDate, endDate } = req.query;

        // Secara default (jika tab "Minggu" aktif), ambil data 7 hari terakhir
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date();
        if (!startDate) {
            start.setDate(end.getDate() - 6); // Tarik 6 hari ke belakang + hari ini = 7 hari
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Filter dasar yang akan dipakai berulang kali
        const dateFilter = {
            createdAt: {
                gte: start,
                lte: end
            }
        };

        //   Sum order
        const orderStats = await prisma.order.aggregate({
            _sum: { totalPrice: true },
            _count: { id: true },
            where: dateFilter
        });

        const totalRevenue = orderStats._sum.totalPrice || 0;
        const totalOrders = orderStats._count.id || 0;

        // Rata-rata pendapatan per transaksi
        const averageRevenue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        // sum order detail
        const itemStats = await prisma.orderDetail.aggregate({
            _sum: { qty: true },
            where: {
                order: dateFilter // Menyaring orderDetail berdasarkan tanggal ordernya
            }
        });
        const totalItemsSold = itemStats._sum.qty || 0;

        //    menu terlaris
        const topSellingData = await prisma.orderDetail.groupBy({
            by: ['menuId'],
            _sum: { qty: true },
            where: { order: dateFilter },
            orderBy: { _sum: { qty: 'desc' } },
            take: 4
        });

        const menuIds = topSellingData.map(item => item.menuId);
        const menus = await prisma.menu.findMany({
            where: { id: { in: menuIds } },
            select: { id: true, name: true }
        });

        const topSelling = topSellingData.map(item => {
            const menu = menus.find(m => m.id === item.menuId);
            return {
                name: menu ? menu.name : "Menu Dihapus",
                sold: item._sum.qty
            };
        });

        //    Growth Penjualan
        const ordersForChart = await prisma.order.findMany({
            where: dateFilter,
            select: { createdAt: true, totalPrice: true },
            orderBy: { createdAt: 'asc' }
        });

        // mapping data per hari
        const daysLabel = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const growthMap = {};

        ordersForChart.forEach(order => {
            const dateKey = order.createdAt.toISOString().split('T')[0];
            const dayName = daysLabel[order.createdAt.getDay()];

            if (!growthMap[dateKey]) {
                growthMap[dateKey] = { date: dateKey, day: dayName, revenue: 0 };
            }
            growthMap[dateKey].revenue += order.totalPrice;
        });

        const salesGrowth = Object.values(growthMap);

        res.status(200).json({
            message: "Data dashboard berhasil ditarik",
            data: {
                summary: {
                    totalItemsSold,
                    totalRevenue,
                    averageRevenue
                },
                topSelling,
                salesGrowth
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};