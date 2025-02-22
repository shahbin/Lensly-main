const express = require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const orderController = require("../controllers/admin/orderController")
const couponController = require("../controllers/admin/couponController")
const salesController = require("../controllers/admin/salesController")
const {userAuth,adminAuth, checkAdmin} = require("../middlewares/auth")
const uploads = require("../helpers/multer")
const {handleSingleUpload,handleMultipleUpload} = require("../helpers/multer")


router.get('/pageError',adminController.pageError)
router.get('/',checkAdmin,adminController.loadLogin)
router.post('/',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)

router.get('/users',adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerUnBlocked)

router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.post('/addCategoryOffer',adminAuth,categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',adminAuth,categoryController.removeCategoryOffer)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unListCategory',adminAuth,categoryController.getUnListCategory)
router.get('/editCategory',adminAuth,categoryController.getEditCategory)
router.post('/editCategory/:id',adminAuth,categoryController.editCategory)

router.get('/brands',adminAuth,brandController.getBrandPage)
router.post('/addBrand',adminAuth,handleSingleUpload,brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unblockBrand",adminAuth,brandController.unblockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)

router.get('/addProducts',adminAuth,productController.getProductAddPage)
router.post('/addProducts',adminAuth,handleMultipleUpload,productController.addProducts)
router.get('/products',adminAuth,productController.getAllProducts)
router.post('/addProductOffer', adminAuth,productController.addProductOffer);
router.post('/removeProductOffer', adminAuth,productController.removeProductOffer);
router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,handleMultipleUpload, productController.updateProduct);

router.get('/orders', adminAuth, orderController.getAllOrders)
router.post('/orders/update-status', adminAuth, orderController. updateOrderItemStatus);
router.get('/orderDetails/:orderId', adminAuth, orderController.getOrderDetails);
router.post('/process-return/:orderId/:itemId', adminAuth,orderController. processReturnRequest);

router.get('/coupon',adminAuth,couponController.getCouponPage)
router.post('/createCoupon',adminAuth,couponController.createCoupon)
router.get('/editCoupon',adminAuth,couponController.getEditCoupon)
router.post('/updateCoupon',adminAuth,couponController.updateCoupon)
router.post('/deleteCoupon',adminAuth,couponController.deleteCoupon)

router.get('/salesReport', adminAuth, salesController.loadSalesReport);
router.get('/sales-report/download-pdf', adminAuth, salesController.downloadPdf);
router.get('/sales-report/download-excel', adminAuth, salesController.downloadExcel);

module.exports = router;