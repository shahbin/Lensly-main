const express = require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const {userAuth,adminAuth} = require("../middlewares/auth")
const uploads = require("../helpers/multer")
const handleUpload = require("../helpers/multer")


router.get('/pageError',adminController.pageError)
router.get('/',adminController.loadLogin)
router.post('/',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)

router.get('/users',adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerUnBlocked)

router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unListCategory',adminAuth,categoryController.getUnListCategory)
router.get('/editCategory',adminAuth,categoryController.getEditCategory)
router.post('/editCategory/:id',adminAuth,categoryController.editCategory)

router.get('/brands',adminAuth,brandController.getBrandPage)
router.post('/addBrand',adminAuth,handleUpload,brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unblockBrand",adminAuth,brandController.unblockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)

router.get('/addProducts',adminAuth,productController.getProductAddPage)
router.post('/addProducts',adminAuth,handleUpload,productController.addProducts)
router.get('/products',adminAuth,productController.getAllProducts)
router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,handleUpload, productController.updateProduct);


module.exports = router;