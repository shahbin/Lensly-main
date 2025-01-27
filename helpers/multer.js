const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        
        cb(null, path.join(process.cwd(), "public/admin-assets/imgs/brands"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploads = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, 
    },
}).array('images', 5); 

const handleUpload = (req, res, next) => {
    uploads(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            
            return res.status(400).json({ error: err.message });
        } else if (err) {
            
            return res.status(500).json({ error: "Error uploading files" });
        }
        
        next();
    });
};

module.exports = handleUpload;