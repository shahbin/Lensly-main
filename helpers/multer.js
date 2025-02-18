const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), "public/admin-assets/imgs/brands");
        fs.mkdirSync(dir, { recursive: true }); // Create directory if it doesn't exist
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer configuration for single file upload
const uploadSingle = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
}).single('image'); // Use .single() for a single file upload

// Multer configuration for multiple file uploads
const uploadMultiple = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
    },
}).array('images', 5); // Use .array() for multiple file uploads (max 5 files)

// Middleware for single file upload
const handleSingleUpload = (req, res, next) => {
    uploadSingle(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(400).json({ error: err.message });
        } else if (err) {
            console.error("Upload Error:", err);
            return res.status(500).json({ error: "Error uploading file" });
        }
        console.log("Single file uploaded successfully:", req.file);
        next();
    });
};

// Middleware for multiple file uploads
const handleMultipleUpload = (req, res, next) => {
    uploadMultiple(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(400).json({ error: err.message });
        } else if (err) {
            console.error("Upload Error:", err);
            return res.status(500).json({ error: "Error uploading files" });
        }
        console.log("Multiple files uploaded successfully:", req.files);
        next();
    });
};


module.exports = {
    handleSingleUpload,
    handleMultipleUpload
}