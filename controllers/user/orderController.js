const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Product = require('../../models/productSchema')

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.render('order-details', {
        order: null,
        error: 'Order not found',
        user: req.session.user
      });
    }

    const addressDoc = await Address.findOne({ userId });
    console.log('Address doc:', addressDoc);
    if (addressDoc && addressDoc.addresses) {
      const orderAddress = addressDoc.addresses.find(
        addr => addr._id.toString() === order.address.toString()
      );
      order.shippingAddress = orderAddress || null;
    }

    res.render('order-details', {
      order,
      error: null,
      user: req.session.user
    });

  } catch (error) {
    console.error('Order details error:', error);
    res.render('order-details', {
      order: null,
      error: 'Failed to load order details',
      user: req.session.user
    });
  }
}

const getOrdersList = async (req, res) => {
  try {
    const userId = req.session.user; 
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); 

    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ orders });
    }

    res.render('order-list', { 
      orders, 
      error: null,
      user: req.session.user,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: "Server error" });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Find the specific item
    const orderItem = order.orderedItems.id(itemId);
    if (!orderItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order item not found' 
      });
    }

    if(orderItem.status == 'Cancelled'){
      return res.status(404).json({ 
        success: false, 
        message: 'Order alredy caled' 
      })
    }

    const product = await Product.findOne({_id : orderItem.product})
    product.quantity += orderItem.quantity
    product.save();

    orderItem.status = 'Cancelled';

    const allItemsCancelled = order.orderedItems.every(item => item.status === 'Cancelled');
    if (allItemsCancelled) {
      order.status = 'Cancelled';
    }

    const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
    order.totalPrice = activeItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    order.finalAmount = order.totalPrice + 49 - order.discount; 

    await order.save();

    res.status(200).json({ 
      success: true, 
      message: 'Order item cancelled successfully',
      newTotal: order.finalAmount
    });

  } catch (error) {
    console.error('Error cancelling order item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel order item' 
    });
  }
};

module.exports = {
  getOrderDetails,
  getOrdersList,
  cancelOrderItem
};