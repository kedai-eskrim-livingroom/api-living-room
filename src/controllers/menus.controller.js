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
        const idsToDelete = req.body.id.map(Number);

        for (const menuId of idsToDelete) {
            const menu = await prisma.menu.findUnique({
                where: { id: menuId },
            });

            if (menu) {
                const publicId = menu.photo.split("/").pop().split(".")[0];
                const publicFolder = menu.photo.split("/").slice(-2, -1)[0];
                await deleteImage(publicId, publicFolder);
            }
        }

        await prisma.menu.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        res.json({ message: "Menu berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};