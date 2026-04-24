import prisma from "../../prisma/client.js";

// Mengambil semua data akun (Biasanya untuk Admin)
export const getAccounts = async (req, res) => {
    try {
        const data = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            where: {
                role: { equals: 'PENJAGA' }
            }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Membuat akun baru (Untuk Admin)
export const createAccount = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: `Kolom ${!name ? "Nama" : !email ? "Email" : !password ? "Password" : "Peran"} harus diisi` });
        }

        // validasi email (harus unik)
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: "Email sudah digunakan, silakan gunakan email lain" });
        }

        const data = await prisma.user.create({
            data: {
                name,
                email,
                password,
                role: 'PENJAGA'
            }
        });

        res.status(201).json({ message: "Akun berhasil dibuat", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, role } = req.body;

        const existing = await prisma.user.findUnique({
            where: { id: Number(id) },
        });

        if (!existing) {
            return res.status(404).json({ message: "Akun tidak ditemukan" });
        }

        if (email && email !== existing.email) {
            const checkDuplicate = await prisma.user.findUnique({ where: { email } });
            if (checkDuplicate) {
                return res.status(400).json({ message: "Email sudah digunakan, silakan gunakan email lain" });
            }
        }

        const data = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                name: name || existing.name,
                email: email || existing.email,
                password: password || existing.password,
                role: role || existing.role
            }
        });

        res.json({ message: "Akun berhasil diperbarui", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const idsToDelete = req.body.id.map(Number);

        await prisma.user.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        res.json({ message: "Akun berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
