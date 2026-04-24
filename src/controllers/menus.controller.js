import prisma from "../../prisma/client.js";
import { deleteImage, upload } from "../middleware/cloudinary.js";

export const getMenu = async (req, res) => {
    try {
        const data = await prisma.menu.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createMenu = async (req, res) => {
    try {
        const photoFile = req.file;
        const { name, price, description } = req.body;

        if (!photoFile || !description || !name || !price) {
            return res.status(400).json({ message: `Kolom ${!photoFile ? "Foto" : !description ? "Deskripsi" : !name ? "Nama" : "Harga"} harus diisi` });
        }

        const cloudinaryPhoto = await upload(photoFile, "menus");

        const data = await prisma.menu.create({
            data: {
                name,
                description,
                price: Number(price),
                photo: cloudinaryPhoto.url
            }
        });

        res.status(201).json({ message: "Menu dibuat", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const photoFile = req.file;
        const { name, price, description, photo } = req.body;

        const existing = await prisma.menu.findUnique({
            where: { id: Number(id) },
        });

        if (!existing) {
            return res.status(404).json({ message: "Menu tidak ditemukan" });
        }

        if (!description || !name || !price) {
            return res.status(400).json({ message: `Kolom ${!description ? "Deskripsi" : !name ? "Nama" : "Harga"} harus diisi` });
        }

        let fotoUrl = existing.photo;

        // Kalo up file baru
        if (photoFile) {
            const publicId = existing.photo.split("/").pop().split(".")[0];
            const publicFolder = existing.photo.split("/").slice(-2, -1)[0];

            await deleteImage(publicId, publicFolder);
            const uploadResult = await upload(photoFile, "menus"); // Konsisten gunakan folder "menus"
            fotoUrl = uploadResult.url;
        }
        // kalo pake foto lama kirim string
        else if (photo && typeof photo === "string" && photo.trim() !== "") {
            fotoUrl = photo;
        }

        const data = await prisma.menu.update({
            where: { id: Number(id) },
            data: {
                name,
                description,
                price: Number(price),
                photo: fotoUrl
            }
        });

        res.json({ message: "Menu diperbarui", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteMenu = async (req, res) => {
    try {
        // 1. Validasi Input
        if (!req.body.id || !Array.isArray(req.body.id)) {
            return res.status(400).json({ message: "ID menu tidak valid" });
        }

        const idsToDelete = req.body.id.map(Number);

        // ====================================================================
        // 2. PRE-CHECK: PENGECEKAN MANUAL (100% ANTI BOCOR)
        // Kita cek dulu apakah menu ini pernah dibeli dan masuk di OrderDetail
        // ====================================================================
        const isMenuUsed = await prisma.orderDetail.findFirst({
            where: {
                menuId: { in: idsToDelete }
            }
        });

        // JIKA PERNAH DIBELI: Tolak langsung! Sistem akan berhenti di sini.
        // Database aman, Cloudinary juga aman (karena kodenya ada di bawah).
        if (isMenuUsed) {
            return res.status(400).json({
                message: "Gagal menghapus: Menu ini sudah tercatat dalam riwayat pesanan pelanggan. Tidak boleh dihapus."
            });
        }

        // ====================================================================
        // 3. JIKA LOLOS PENGECEKAN, LANJUT PROSES HAPUS
        // ====================================================================

        // Ambil data menu untuk mengambil URL foto
        const menus = await prisma.menu.findMany({
            where: { id: { in: idsToDelete } },
        });

        if (menus.length === 0) {
            return res.status(404).json({ message: "Menu tidak ditemukan" });
        }

        // Hapus data menu dari Database Prisma
        await prisma.menu.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        // Hapus foto dari Cloudinary
        for (const menu of menus) {
            if (menu.photo) {
                try {
                    const publicId = menu.photo.split("/").pop().split(".")[0];
                    const publicFolder = menu.photo.split("/").slice(-2, -1)[0];
                    await deleteImage(publicId, publicFolder);
                } catch (cloudinaryErr) {
                    console.warn(`[Info] Gagal hapus foto di Cloudinary untuk menu ID ${menu.id}, tapi database sukses.`);
                }
            }
        }

        return res.json({ message: "Menu beserta foto berhasil dihapus" });

    } catch (error) {
        console.error("Error Delete Menu:", error);
        return res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
    }
};