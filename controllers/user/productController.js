const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema")

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);  // Fetching user data
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category'); // Fetch product data with category populated
        const findCategory = product.category;

        // Fetch related products based on the category, excluding the current product
        const relatedProduct = await Product.find({ 
            category: findCategory._id, 
            _id: { $ne: product._id } 
        }).limit(3); // Limit related products to 3

        let isInWishlist = false;
        
        // Check if the product is in the user's wishlist
        if (userId) {
            const wishlist = await Wishlist.findOne({
                userId,
                'products.productId': productId  // Check if productId is in the wishlist
            });
            isInWishlist = !!wishlist;  // Set isInWishlist to true if found, else false
        }

        // Render the product details page with the necessary data
        res.render("product-details", {
            user: userData,
            product: product,
            quantity: product.quantity,
            relatedProduct: relatedProduct,
            isInWishlist: isInWishlist
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");  // Redirect to error page if something goes wrong
    }
}



module.exports = {
    productDetails
}