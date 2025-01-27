const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer")

const getProductAddPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });
        res.render("product-add", {
            cat: categories,
            brand: brands
        });
    } catch (error) {
        console.error("Error in getProductAddPage:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) {
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }
            return res.status(400).json({ error: "Product already exists" });
        }

        const category = await Category.findOne({ name: products.category });
        if (!category) {
            return res.status(400).json({ error: "Invalid category" });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "At least one image is required" });
        }

        const processedImages = [];
        for (const file of req.files) {
            try {
                const outputFilename = `processed_${path.basename(file.filename)}`;
                const outputPath = path.join(
                    "public",
                    "admin-assets",
                    "imgs",
                    "brands",
                    outputFilename
                );

                await sharp(file.path)
                    .resize(440, 440, {
                        fit: "contain",
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .jpeg({ quality: 90 })
                    .toFile(outputPath);

                setTimeout(() => {
                    fs.unlink(file.path, (err) => {
                        if (err) {
                            console.error(`Error deleting file ${file.path}:`, err);
                        }
                    });
                }, 500);

                processedImages.push(outputFilename);
            } catch (error) {
                console.error("Error processing image:", error);
            }
        }

        if (processedImages.length === 0) {
            return res.status(400).json({ error: "Failed to process any images" });
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: category._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice) || 0,
            createdOn: new Date(),
            quantity: parseInt(products.quantity, 10),
            productImage: processedImages,
            status: "Available"
        });

        await newProduct.save();

        return res.status(200).json({
            success: true,
            message: "Product added successfully",
            productId: newProduct._id
        });
    } catch (error) {
        
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        console.error("Error in addProducts:", error);
        return res.status(500).json({ error: "Error adding product", details: error.message });
    }
};



const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const searchQuery = search ? {
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ]
        } : {};

        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        const productData = await Product.find(searchQuery)
            .sort({ _id: -1 }) 
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('category')
            .exec();

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        res.render("products", {
            data: productData,
            currentPage: page,
            totalPages: totalPages,
            search: search,
            cat: category,
            brand: brand
        });
    } catch (error) {
        console.error("Pagination error:", error);
        res.redirect('/pageError');
    }
};


const blockProduct = async (req,res)=>{
    try {
        
        const productId = req.query.id;
        const product = await Product.findByIdAndUpdate({_id:productId},{$set:{isBlocked:true}})
        res.redirect('/admin/products')

    } catch (error) {
        
        res.redirect("/pageError")

    }
}



const unblockProduct = async (req,res)=>{
    try {
        
        const productId = req.query.id;
        const product = await Product.findByIdAndUpdate({_id:productId},{$set:{isBlocked:false}})
        res.redirect("/admin/products")

    } catch (error) {

        res.redirect("/pageError")

    }
}


const getEditProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findOne({ _id: productId });
        const category = await Category.find({});
        const brand = await Brand.find({});
        res.render("product-edit", {
            product: product,
            cat: category,
            brand: brand
        });
    } catch (error) {
        console.log('error while loading editn page' ,error);
        
        res.redirect('/pageError');
    }
};

const updateProduct = async (req, res) => {
    const tempFiles = []; 

    try {
        const productId = req.params.id;
        const updates = req.body;
        const existingProduct = await Product.findById(productId);
        
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const category = await Category.findOne({ 
            $or: [
                { _id: updates.category },
                { name: updates.category }
            ]
        });

        if (!category) {
            return res.status(400).json({ success: false, message: "Invalid category" });
        }

        let finalImages = [...existingProduct.productImage];

        if (updates.removedImages) {
            const removedImages = JSON.parse(updates.removedImages);
            finalImages = finalImages.filter(img => !removedImages.includes(img));
            
            for (const filename of removedImages) {
                const filepath = path.join(process.cwd(), "public", "admin-assets", "imgs", "brands", filename);
                try {
                    if (fs.existsSync(filepath)) {

                        await new Promise(resolve => setTimeout(resolve, 100));
                        await fs.promises.unlink(filepath);

                    }
                } catch (error) {
                    console.error(`Failed to delete image ${filename}:`, error.message);
                   
                }
            }
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
            
                    const timestamp = Date.now();
                    const randomString = Math.random().toString(36).substring(7);
                    const newFilename = `product-${timestamp}-${randomString}.jpg`;
                    const outputPath = path.join(process.cwd(), "public", "admin-assets", "imgs", "brands", newFilename);
                    
                    tempFiles.push(file.path); 
                    
                    await sharp(file.path)
                        .resize(400, 400, {
                            fit: "contain",
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(outputPath);
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    finalImages.push(newFilename);
                } catch (error) {
                    console.error(`Failed to process image ${file.originalname}:`, error.message);
                    continue;
                }
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                productName: updates.productName,
                description: updates.description,
                brand: updates.brand,
                category: category._id,
                regularPrice: parseFloat(updates.regularPrice),
                salePrice: parseFloat(updates.salePrice) || 0,
                quantity: parseInt(updates.quantity, 10),
                productImage: finalImages
            },
            { new: true }
        );

        await cleanupTempFiles(tempFiles);

        return res.json({ 
            success: true, 
            message: "Product updated successfully",
            product: updatedProduct
        });

    } catch (error) {
        
        await cleanupTempFiles(tempFiles);
        
        console.error("Error updating product:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Error updating product" 
        });
    }
};

async function cleanupTempFiles(files) {
    for (const file of files) {
        try {
            if (fs.existsSync(file)) {
                await new Promise(resolve => setTimeout(resolve, 100)); 
                await fs.promises.unlink(file);
            }
        } catch (err) {
            console.error("Error cleaning up temporary file:", err);
        }
    }
}




module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    updateProduct
};
