const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController")
const { userAuth, adminAuth, checkUser } = require("../middlewares/auth");

router.get("/pageNotFound", userController.pageNotFound);
router.get('/signup', checkUser, userController.loadSignup);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    console.log('Authentication successful');
    console.log('User:', req.user);
    req.session.user = req.user._id;
    return res.redirect('/');
  }
);
router.get("/", userController.loadHomePage);
router.get('/login', checkUser, userController.loadLogin);
router.post('/login', userController.login);
router.get("/logout", userController.logout);
router.get('/reset-password', profileController.forgotPassword);
router.post('/verifyMail', profileController.forgotEmailValid);
router.post('/verifyEmail-otp', profileController.verifyEmailOtp);
router.post('/resendEmail-otp', profileController.resendEmailOtp);
router.get('/create-password', profileController.createPassword);
router.post('/create-password', profileController.saveNewPassword);

router.get('/shop', userController.loadShopPage);

router.get('/productDetails', productController.productDetails);
router.get('/userProfile', userAuth, profileController.userProfile);
router.post('/editProfile', userAuth, profileController.editProfile);
router.post('/changePassword', userAuth, profileController.changePassword);
router.post('/addAddress', userAuth, profileController.addAddress);
router.get('/addresses', userAuth, profileController.getAddresses);
router.put('/addresses/:id', userAuth, profileController.editAddress);
router.delete('/addresses/:id', userAuth, profileController.deleteAddress);

router.get('/cart', userAuth, cartController.getCart);
router.post('/cart', userAuth, cartController.addToCart);
router.post('/update-cart', userAuth, cartController.updateCart);
router.delete('/removeFrom-cart/:productId', userAuth, cartController.removeFromCart);

router.get('/checkout', userAuth, cartController.getCheckout);
router.post('/place-order', userAuth, cartController.placeOrder);

router.post('/placeOrderRazorPay',userAuth,orderController.orderRazorpay)
router.post('/verifyRazorPayOrder',userAuth,orderController.verifyRazorPayOrder)
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetails);

router.get('/search', userController.searchProducts);
router.get('/orders-list',userAuth,orderController.getOrdersList);

router.post('/cancel-order-item/:orderId/:itemId', orderController.cancelOrderItem);
router.post('/returnOrder/:orderId/:itemId', orderController.returnOrder);


router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/add/:productId', userAuth, wishlistController.addToWishlist);
router.post('/remove/:productId', userAuth, wishlistController.removeFromWishlist);
router.get('/check-wishlist/:productId', userAuth, wishlistController.checkWishlist);

router.get("/available-coupons",userAuth,orderController.getAvailableCoupons);
router.post('/apply-coupon',userAuth,orderController.applyCoupon);

router.get('/wallet',userAuth,profileController.getWalletPage)
router.post('/walletPayment',userAuth,orderController.walletPayment)


module.exports = router;