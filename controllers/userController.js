const Product = require('../models/Product'); // Assuming you have a Product model

// ...existing code...

const loadShopPage = async (req, res) => {
    try {
        console.log("Loading shop page"); // Add logging

        // Get query parameters
        const { minPrice, maxPrice, category, sort } = req.query;

        // Build the filter object
        let filter = {};
        if (minPrice || maxPrice) {
            filter.salePrice = {};
            if (minPrice) filter.salePrice.$gte = parseInt(minPrice);
            if (maxPrice) filter.salePrice.$lte = parseInt(maxPrice);
        }
        if (category) {
            filter['category.name'] = { $in: category.split(",") }; // Correct the category filter
        }

        // Build the sort object
        let sortOption = {};
        if (sort) {
            switch (sort) {
                case 'priceLowToHigh':
                    sortOption.salePrice = 1;
                    break;
                case 'priceHighToLow':
                    sortOption.salePrice = -1;
                    break;
                case 'newArrivals':
                    sortOption.createdAt = -1;
                    break;
                case 'aToZ':
                    sortOption.productName = 1;
                    break;
                case 'zToA':
                    sortOption.productName = -1;
                    break;
                default:
                    sortOption = {};
            }
        }

        // Fetch products from the database
        const products = await Product.find(filter).sort(sortOption);

        // Render the shop page with the filtered and sorted products
        res.render('user/shop', {
            products,
            selectedCategory: category ? category.split(",") : [],
            selectedSort: sort || '',
        });
    } catch (error) {
        console.error("Error loading shop page:", error);
        res.status(500).send("Internal Server Error");
    }
};

// ...existing code...

module.exports = {
    // ...existing exports...
    getFilteredProducts,
    loadShopPage, // Add this line
};
