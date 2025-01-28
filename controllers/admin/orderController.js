const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const getAllOrders = async (req, res) => {
    console.log('getAllOrders');
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    try {
        const orders = await Order.find()
            .populate('orderedItems.product')
            .populate('address')
            .populate('userId')
            .sort({ createdOn: -1 }) 
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('order', { 
            orders, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};


const updateOrderStatus = async (req, res) => {
    const { orderId, status } = req.body;
    try {
        const order = await Order.findOneAndUpdate(
            { orderId }, 
            { status }, 
            { new: true }
        );
        
        if (!order) {
            return res.status(404).send('Order not found');
        }


        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error');
    }
};


const getOrderDetails = async (req, res) => {
    try {
      const { orderId } = req.params;
  
      const order = await Order.findOne({ _id: orderId })
        .populate('orderedItems.product').populate('userId');
        
  
      if (!order) {
        return res.render('orderDetails', {
          order: null,
          error: 'Order not found',
          user: req.session.user
        });
      }
  
      const user = await User.findOne({email : order.userId.email})
      const addressDoc = await Address.findOne({ userId : user._id });

      if (addressDoc && addressDoc.addresses) {
        const orderAddress = addressDoc.addresses.find(
          addr => addr._id.toString() === order.address.toString()
        );
        order.shippingAddress = orderAddress || null;
      }

      console.log(order.orderedItems[0].product)
  
      res.render('orderDetails', {
        order,
        error: null,
        user: req.session.user
      });
  
    } catch (error) {
      console.error('Order details error:', error);
      res.render('orderDetails', {
        order: null,
        error: 'Failed to load order details',
        user: req.session.user
      });
    }
  }


module.exports = {
    getAllOrders,
    updateOrderStatus,
    getOrderDetails
}