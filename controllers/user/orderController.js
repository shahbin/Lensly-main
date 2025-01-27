const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params
    const userId = req.session.user._id

    const order = await Order.findOne({ _id: orderId, userId }).populate('orderedItems.product').populate('address')
    console.log(order,'order')
    if (!order) {
      return res.render('order-details', { 
        order: null, 
        error: 'Order not found',
        user: req.session.user 
      })
    }


    res.render('order-details', { 
      order, 
      error: null,
      user: req.session.user 
    })

  } catch (error) {
    console.error('Order details error:', error);
    res.render('order-details', { 
      order: null, 
      error: 'Failed to load order details',
      user: req.session.user
    })
  }
}










module.exports = {
  getOrderDetails
};