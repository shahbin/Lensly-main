const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number, default: 0 },
    createdOn: { type: Date, default: Date.now },
    quantity: { type: Number, required: true },
    productImage: { type: [String], required: true },
    status: { type: String, default: 'Available' },
    isBlocked: { type: Boolean, default: false }
});

module.exports = mongoose.model('Product', productSchema);