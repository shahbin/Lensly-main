const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const getAllOrders = async (req, res) => {
    console.log('getAllOrders');
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
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


  const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, newStatus } = req.body;

        const order = await Order.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const orderItem = order.orderedItems.id(itemId);
        
        if (!orderItem) {
            return res.status(404).json({ message: 'Order item not found' });
        }

        if (orderItem.status == "Cancelled"){
          return res.status(400).json({success: false, error:"Cannot change status of a cancelled item"})
        }

        orderItem.status = newStatus;
        await order.save();

        const itemStatuses = order.orderedItems.map(item => item.status);
        if (itemStatuses.every(s => s === "Delivered")) {
            order.status = "Delivered";
        } else if (itemStatuses.some(s => s === "Processing" || s === "Shipped" || s === "Delivered")) {
            order.status = "Processing";
        } else if (itemStatuses.some(s => s === "Pending")) {
            order.status = "Pending";
        } else if (itemStatuses.some(s => s === "Cancelled" || s === "Return request" || s === "Returned")) {
            order.status = "Cancelled";
        } else {
            order.status = "Pending";
        }
        await order.save();

        res.status(200).json({ 
            message: 'Status updated successfully',
            newStatus: newStatus
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ 
            message: 'Error updating order status',
            error: error.message 
        });
    }
};

module.exports = {
    getAllOrders,
    updateOrderStatus,
    getOrderDetails,
    updateOrderItemStatus
}