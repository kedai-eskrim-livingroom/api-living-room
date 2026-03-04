import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: ".env" });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "living-room";

export const upload = async (file, folder) => {
    try {
        if (!file || !file.buffer) {
            throw new Error("File tidak ditemukan atau format tidak valid");
        }

        const compressedBuffer = await sharp(file.buffer)
            .resize({ width: 1280, withoutEnlargement: true }) // batasi ukuran maksimum
            .jpeg({ quality: 70 }) // kompres ke JPEG dengan kualitas 70%
            .toBuffer();

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: `${CLOUDINARY_FOLDER}/${folder || ""}` }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
            stream.end(compressedBuffer);
        });

        return {
            url: result.secure_url,
            public_id: result.public_id,
        };
    } catch (error) {
        console.error("Upload error:", error);
        throw new Error("Gagal upload ke Cloudinary");
    }
};

export const deleteImage = async (publicId, publicFolder) => {
    try {
        const publicCloudinary = `${CLOUDINARY_FOLDER}/${publicFolder}/${publicId}`

        const result = await cloudinary.uploader.destroy(publicCloudinary, { resource_type: 'image' });
        if (result.result === "not found") {
            throw new Error("Gambar tidak ditemukan di Cloudinary");
        }
        return result;
    } catch (error) {
        console.error("Delete error:", error);
        throw new Error("Gagal menghapus gambar di Cloudinary");
    }
};
