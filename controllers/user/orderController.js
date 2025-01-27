const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;

    // Fetch order with populated product details
    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.render('order-details', {
        order: null,
        error: 'Order not found',
        user: req.session.user
      });
    }

    // Fetch address details separately
    const addressDoc = await Address.findOne({ userId });
    console.log('Address doc:', addressDoc);
    if (addressDoc && addressDoc.addresses) {
      // Find the specific address used in this order
      const orderAddress = addressDoc.addresses.find(
        addr => addr._id.toString() === order.address.toString()
      );
      // Attach the address to the order object
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
    const userId = req.session.user; // Ensure user ID is correctly retrieved
    const orders = await Order.find({ userId }).populate('orderedItems.product')
    // Check if the request is an AJAX request
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ orders });
    }

    res.render('order-list', { // Ensure the correct path to the view
      orders, 
      error: null,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getOrderDetails,
  getOrdersList
};