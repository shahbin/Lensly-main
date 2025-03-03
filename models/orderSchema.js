const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    productImage: {
      type: [String],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: 'Pending',
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned',]
    },
    returnReason: {
      type: String, 
      default: null
    },
    returnRequestedAt: {
      type: Date, 
      default: null
    },
    cancelReason: {
      type: String, 
      default: null
    },
    cancelledAt: {
      type: Date, 
      default: null
    }
  }],
  paymentStatus:{
    type: String,
    default: 'Pending',
    enum: ['Pending', 'Paid','Failed']
  },
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  },
  userId:{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned']
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponId: {
    type: Schema.Types.ObjectId,
    ref: 'Coupon',
  },
  paymentMethod:{
    type:String
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;