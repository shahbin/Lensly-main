const express = require('express');
const router = express.Router();
const productController = require('../controllers/admin/productController');

// ...existing code...

router.get('/products', productController.getAllProducts);

// ...existing code...

module.exports = router;
