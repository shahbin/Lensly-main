const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const Wishlist = require("../../models/wishlistSchema")

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId); 
        const cart = await Cart.findOne({ userId });
        res.locals.cartItems = cart ? cart.items : [];
        res.locals.cartCount = cart ? cart.items.length : 0;
        const wishlistItems = await Wishlist.findOne({userId:userId})
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category');
        const findCategory = product.category;

        const relatedProduct = await Product.find({ 
            category: findCategory._id, 
            _id: { $ne: product._id } 
        }).limit(3); 

        let isInWishlist = false;
        
        if (userId) {
            const wishlist = await Wishlist.findOne({
                userId,
                'products.productId': productId  
            });
            isInWishlist = !!wishlist; 
        }

        res.render("product-details", {
            user: userData,
            product: product,
            quantity: product.quantity,
            relatedProduct: relatedProduct,
            isInWishlist: isInWishlist,
            cartItems: res.locals.cartItems,
            wishlistItems: wishlistItems.products
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound"); 
    }
}



module.exports = {
    productDetails
}