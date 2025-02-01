const Wishlist = require("../../models/wishlistSchema")
const User = require("../../models/userSchema")

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user
        
        // Fetch wishlist with populated product details
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                select: 'productName productImage regularPrice salePrice quantity status' 
            });

        // Format the data for the frontend
        const wishlistItems = wishlist ? wishlist.products.map(item => ({
            product: {
                productName: item.productId.productName,
                productImage: item.productId.productImage,
                price: item.productId.salePrice > 0 ? item.productId.salePrice : item.productId.regularPrice,
                status: item.productId.status,
                quantity: item.productId.quantity,
                _id: item.productId._id
            },
            addedOn: item.addedOn
        })) : [];

        const user = await User.findById(userId);
        
        res.render('wishlist', {
            user,
            wishlist: wishlistItems
        });

    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).render('error', { message: 'Failed to fetch wishlist' });
    }
}


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.productId;

        // Check if wishlist exists for user
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            // If no wishlist exists, create new one
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await wishlist.save();
        } else {
            // Check if product already exists in wishlist
            const productExists = wishlist.products.some(item => 
                item.productId.toString() === productId
            );

            if (!productExists) {
                // Add product to existing wishlist
                wishlist.products.push({ productId });
                await wishlist.save();
            }
        }

        res.json({ 
            success: true, 
            message: 'Product added to wishlist' 
        });

    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add product to wishlist' 
        });
    }
};

const mongoose = require('mongoose'); // Import mongoose for ObjectId

const removeFromWishlist = async (req, res) => {
    try {
        console.log("Request received!");
        console.log("Product ID:", req.params.productId || req.body.productId);

        const userId = req.session.user;
        let productId = req.params.productId || req.body.productId;

        // Convert productId to ObjectId if needed
        if (mongoose.Types.ObjectId.isValid(productId)) {
            productId = new mongoose.Types.ObjectId(productId);
        }

        const result = await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: productId } } }
        );

        console.log("MongoDB Update Result:", result);

        if (result.modifiedCount > 0) {
            res.json({ success: true, message: 'Product removed from wishlist' });
        } else {
            res.status(404).json({ success: false, message: 'Product not found in wishlist' });
        }
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove product from wishlist' });
    }
};


const checkWishlist = async (req, res) => {
    try {
        const userId = req.session.user;  // Assuming the user ID is in the session
        const productId = req.params.productId;  // Get the product ID from the URL params

        // Check if the product is in the wishlist for the user
        const wishlist = await Wishlist.findOne({
            userId,
            'products.productId': productId  // Look for the product in the wishlist
        });

        // Respond with whether the product is in the wishlist
        res.json({ inWishlist: !!wishlist });  // True if product is found, otherwise false
    } catch (error) {
        console.error('Error checking wishlist:', error);
        res.status(500).json({ inWishlist: false, message: 'Server error' });
    }
};



module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist
}