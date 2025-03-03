const Wishlist = require("../../models/wishlistSchema")
const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")
const mongoose = require('mongoose'); 

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            res.locals.wishlistItems = [];  
            return res.render('wishlist', { 
                user: null, 
                wishlist: [], 
                cartItems: [] 
            });
        }

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                select: 'productName productImage regularPrice salePrice quantity status' 
            });

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

        res.locals.wishlistItems = wishlistItems;

        
        res.render('wishlist', {
            user: await User.findById(userId),
            wishlist: wishlistItems
        });

    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).render('error', { message: 'Failed to fetch wishlist' });
    }
};


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.productId;

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await wishlist.save();
        } else {
            const productExists = wishlist.products.some(item => 
                item.productId.toString() === productId
            );

            if (!productExists) {
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


const removeFromWishlist = async (req, res) => {
    try {

        const userId = req.session.user;
        let productId = req.params.productId || req.body.productId;

        if (mongoose.Types.ObjectId.isValid(productId)) {
            productId = new mongoose.Types.ObjectId(productId);
        }

        const result = await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId: productId } } }
        );

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
        const userId = req.session.user;  
        const productId = req.params.productId;  
        const wishlist = await Wishlist.findOne({
            userId,
            'products.productId': productId  
        });
        res.json({ inWishlist: !!wishlist }); 
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