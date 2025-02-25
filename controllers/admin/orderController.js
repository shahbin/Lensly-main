const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const walletHelper = require('../../helpers/walletHelper')
const mongoose = require('mongoose');
const getAllOrders = async (req, res) => {

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

  const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'];
  if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
      const order = await Order.findOneAndUpdate(
          { orderId }, 
          { status }, 
          { new: true }
      );

      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
      }

      res.status(200).json({ success: true, message: 'Order status updated successfully', order });
  } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};


const getOrderDetails = async (req, res) => {
  try {
      const { orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
          return res.render('orderDetails', {
              order: null,
              error: 'Invalid order ID',
              user: req.session.user
          });
      }

      const order = await Order.findOne({ _id: orderId })
          .populate('orderedItems.product')
          .populate('userId')
          .populate('address') 
          .lean();


      if (!order) {
          return res.render('orderDetails', {
              order: null,
              error: 'Order not found',
              user: req.session.user
          });
      }

      if (!order.address && order.userId) {
          const addressDoc = await Address.findOne({ userId: order.userId._id }).lean();
          if (addressDoc && addressDoc.addresses && addressDoc.addresses.length > 0) {
              order.shippingAddress = addressDoc.addresses[0];
          } else {
              order.shippingAddress = {
                  addressType: 'N/A',
                  city: 'N/A',
                  landMark: 'N/A',
                  state: 'N/A',
                  pincode: 'N/A',
                  phone: 'N/A',
                  altPhone: 'N/A'
              };
          }
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
};


  const updateOrderItemStatus = async (req, res) => {
    const { orderId, itemId, newStatus } = req.body;

    const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'];
    if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderItem = order.orderedItems.id(itemId);
        if (!orderItem) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }

        if (orderItem.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot change status of a cancelled item' });
        }
        if (orderItem.status === 'Returned') {
            return res.status(400).json({ success: false, message: 'Cannot change status of a returned item' });
        }
        if (orderItem.status === 'Delivered' && newStatus !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'Cannot change status of a delivered item' });
        }

        orderItem.status = newStatus;

        updateOverallOrderStatus(order);

        await order.save();

        res.status(200).json({ 
            success: true, 
            message: 'Status updated successfully', 
            newStatus: newStatus,
            order 
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating order status', 
            error: error.message 
        });
    }
};


const updateOverallOrderStatus = (order) => {
    const itemStatuses = order.orderedItems.map(item => item.status);

    if (itemStatuses.every(s => s === 'Delivered')) {
        order.status = 'Delivered';
        order.paymentStatus = 'Paid';
    } else if (itemStatuses.some(s => s === 'Processing' || s === 'Shipped' || s === 'Delivered')) {
        order.status = 'Processing';
    } else if (itemStatuses.some(s => s === 'Pending')) {
        order.status = 'Pending';
    } else if (itemStatuses.some(s => s === 'Cancelled' || s === 'Return Requested' || s === 'Returned')) {
        order.status = 'Cancelled';
    } else {
        order.status = 'Pending';
    }
};

const processReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { action, reason } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "accept" or "reject".'
      });
    }


    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('Order Found:', order);

    const orderItem = order.orderedItems.find(item =>
      item._id.toString() === itemId
    );
    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    console.log('Order Item Found:', orderItem);

    if (orderItem.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'This item does not have a pending return request'
      });
    }

    console.log('Item Status:', orderItem.status);

    if (action === 'accept') {
      orderItem.status = 'Returned';
      orderItem.returnRequestedAt = new Date();

      const itemTotal = orderItem.price * orderItem.quantity;
      let returnAmount = 0;

      if (order.couponId) {
        const itemRatio = itemTotal / order.totalPrice;
        const itemDiscount = order.discount * itemRatio;
        returnAmount = itemTotal - itemDiscount;
        order.discount -= itemDiscount;
      } else {
        returnAmount = itemTotal;
      }

      const userId = order.userId;
      try {
        await walletHelper.updateWalletBalance(userId, returnAmount, 'credit');
      } catch (walletError) {
        console.error('Error updating wallet:', walletError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update user wallet.'
        });
      }

      const product = await Product.findById(orderItem.product);
      if (product) {
        product.quantity += orderItem.quantity;
        await product.save();
      } else {
        console.warn('Product not found for ID:', orderItem.product);
      }

      order.totalPrice -= itemTotal;
      const allItemsReturned = order.orderedItems.every(item =>
        item.status === 'Returned'
      );

      if (allItemsReturned) {
        order.status = 'Returned';
        order.finalAmount = 49; 
      } else {
        order.finalAmount = order.totalPrice - (order.discount || 0) + 49;
      }

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Return request accepted successfully. Amount credited to user wallet.'
      });

    } else if (action === 'reject') {
      orderItem.status = 'Delivered';
      orderItem.returnReason = reason;
      orderItem.returnRequestedAt = null;

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Return request rejected successfully.'
      });
    }

  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing return request'
    });
  }
};

module.exports = {
    getAllOrders,
    updateOrderStatus,
    getOrderDetails,
    updateOrderItemStatus,
    processReturnRequest
}