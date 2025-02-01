const Category = require("../../models/categorySchema");
const productSchema = require("../../models/productSchema");
const Product = require("../../models/productSchema");


const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search?.trim();

        // Build the filter object
        let filter = {};
        if (searchQuery) {
            // Case-insensitive search using regex
            filter.name = { $regex: new RegExp(searchQuery, 'i') };
        }

        // Get filtered categories with pagination
        const categoryData = await Category.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalCategories = await Category.countDocuments(filter);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            searchQuery: searchQuery || '' // Pass search query back to view
        });

    } catch (error) {
        console.error("Error in categoryInfo:", error);
        res.redirect("/pageError");
    }
};


const addCategory = async (req,res) =>{
    const {name,description} = req.body;
    try {
        
        const existingCategory = await Category.findOne({name})
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message:"Category added successfully"})

    } catch (error) {

        return res.status(500).json({error:"Internal Server Error"})
        
    }
}


const getListCategory = async (req,res)=>{
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/category")

    } catch (error) {
        
        res.redirect("/pageError")

    }
}


const getUnListCategory = async (req,res)=>{
    try {
        
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/category")

    } catch (error) {
        
        res.redirect("/pageError")

    }
}


const getEditCategory = async (req,res) =>{
    try {
        
        const id = req.query.id;
        const category = await Category.findOne({_id:id})
        res.render("edit-category", {category:category})
    } catch (error) {
        
        res.redirect("/pageError")

    }
}

const editCategory = async (req,res)=>{
    try {
        
        const id = req.params.id;
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({name:categoryName})

        if(existingCategory){
            return res.status(400).json({error:"Category already exists, please choose another name"})
        }

        const updateCategory = await Category.findByIdAndUpdate(id,{
            name : categoryName,
            description : description,
        },{new:true})

        if(updateCategory){
            res.redirect("/admin/category")
        }else{
            res.status(404).json({error:"Category not found"})
        }

    } catch (error) {

        res.status(500).json({error:"Internal Server Error"})

    }
}


const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        // Find category with proper findById syntax
        const category = await Category.findById(categoryId);
        
        if (!category) {
            return res.status(400).json({
                status: false, 
                message: "Category not found"
            });
        }

        // Find all products in the category
        const products = await Product.find({ category: category._id });

        // Check if any product has higher offer (fixed .so to .some)
        const hasHigherProductOffer = products.some(
            (product) => product.productOffer > percentage
        );

        if (hasHigherProductOffer) {
            return res.status(400).json({
                status: false, 
                message: "Some products have higher offers already"
            });
        }

        // Update category offer
        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        // Update all products in the category
        for (const product of products) {
            product.productOffer = 0;
            // Calculate new sale price with category offer
            const discountAmount = (product.regularPrice * percentage) / 100;
            product.salePrice = product.regularPrice - discountAmount;
            product.offerAmount = discountAmount;
            await product.save();
        }

        res.status(200).json({
            status: true,
            message: "Category offer applied successfully"
        });

    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        res.status(500).json({
            status: false, 
            message: "Internal Server Error"
        });
    }
}


const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        
        // First find the category properly
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(400).json({
                status: false, 
                message: "Category not found"
            });
        }

        const percentage = category.categoryOffer;
        
        // Find products in the category
        const products = await Product.find({ category: categoryId });

        // Update products if any exist
        if (products.length > 0) {
            for (const product of products) {
                // Reset sale price to regular price since offer is being removed
                product.salePrice = product.regularPrice;
                product.productOffer = 0;
                product.offerAmount = 0;
                await product.save();
            }
        }

        // Remove the category offer
        category.categoryOffer = 0;
        await category.save();

        res.status(200).json({
            status: true,
            message: "Category offer removed successfully"
        });

    } catch (error) {
        console.error('Error in removeCategoryOffer:', error);
        res.status(500).json({
            status: false, 
            message: "Internal Server Error"
        });
    }
}



module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnListCategory,
    getEditCategory,
    editCategory,
    addCategoryOffer,
    removeCategoryOffer

}