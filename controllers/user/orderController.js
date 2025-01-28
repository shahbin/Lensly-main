const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")

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
      return res.status(404).json({ message: 'Order not found' });
    }

    const itemIndex = order.orderedItems.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    order.orderedItems.splice(itemIndex, 1);
    await order.save();

    res.status(200).json({ message: 'Item cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order item:', error);
    res.status(500).json({ message: 'Failed to cancel order item' });
  }
};

module.exports = {
  getOrderDetails,
  getOrdersList,
  cancelOrderItem
};