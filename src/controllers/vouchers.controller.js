import prisma from "../../prisma/client.js";

// Mengambil semua data voucher (Biasanya untuk Admin)
export const getVouchers = async (req, res) => {
    try {
        const data = await prisma.voucher.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Membuat voucher baru (Untuk Admin)
export const createVoucher = async (req, res) => {
    try {
        const { code, discount, startDate, endDate } = req.body;

        if (!code || !discount || !startDate || !endDate) {
            return res.status(400).json({ message: `Kolom ${!code ? "Kode" : !discount ? "Diskon" : !startDate ? "Tanggal dimulai" : "Tanggal berakhir"} voucher harus diisi` });
        }

        // validasi kode voucher (harus unik) 
        const existingVoucher = await prisma.voucher.findUnique({
            where: { code }
        });

        if (existingVoucher) {
            return res.status(400).json({ message: "Kode voucher sudah digunakan, silakan buat kode lain" });
        }

        const data = await prisma.voucher.create({
            data: {
                code,
                discount: Number(discount),
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            }
        });

        res.status(201).json({ message: "Voucher berhasil dibuat", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discount, startDate, endDate, isUsed } = req.body;

        const existing = await prisma.voucher.findUnique({
            where: { id: Number(id) },
        });

        if (!existing) {
            return res.status(404).json({ message: "Voucher tidak ditemukan" });
        }

        if (code && code !== existing.code) {
            const checkDuplicate = await prisma.voucher.findUnique({ where: { code } });
            if (checkDuplicate) {
                return res.status(400).json({ message: "Kode voucher yang baru sudah dipakai oleh voucher lain" });
            }
        }

        const data = await prisma.voucher.update({
            where: { id: Number(id) },
            data: {
                code: code || existing.code,
                discount: discount ? Number(discount) : existing.discount,
                startDate: startDate ? new Date(startDate) : existing.startDate,
                endDate: endDate ? new Date(endDate) : existing.endDate,
                isUsed: isUsed !== undefined ? isUsed : existing.isUsed
            }
        });

        res.json({ message: "Voucher berhasil diperbarui", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteVoucher = async (req, res) => {
    try {
        const idsToDelete = req.body.id.map(Number);

        await prisma.voucher.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        res.json({ message: "Voucher berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Validasi voucher di penjaga
export const validateVoucher = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ message: "Kode voucher harus diisi" });
        }

        // cek kode voucher
        const voucher = await prisma.voucher.findUnique({
            where: { code }
        });

        if (!voucher) {
            return res.status(404).json({ message: "Voucher tidak ditemukan" });
        }

        // cek voucher udah hangus atau belum
        if (voucher.isUsed) {
            return res.status(400).json({ message: "Voucher ini sudah pernah digunakan (hangus)" });
        }

        // cek voucher udah exp atau belum
        const today = new Date();
        if (today < voucher.startDate) {
            return res.status(400).json({ message: "Voucher ini belum aktif" });
        }
        if (today > voucher.endDate) {
            return res.status(400).json({ message: "Voucher ini sudah kadaluarsa" });
        }

        // tervalidasi
        res.json({
            message: "Voucher valid",
            data: {
                id: voucher.id,
                code: voucher.code,
                discount: voucher.discount
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};