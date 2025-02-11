const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Product = require('../../models/productSchema')
const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const Wallet = require('../../models/walletSchema')
const Wishlist = require('../../models/wishlistSchema')
const Razorpay = require('razorpay');
const dotenv = require("dotenv")
dotenv.config()
const crypto = require("crypto");
const walletHelper = require('../../helpers/walletHelper');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;



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


const getAvailableCoupons = async (req, res) => {
  try {
    
      const currentDate = new Date();
      const availableCoupons = await Coupon.find({ expireOn: { $gte: currentDate } });

      if (!availableCoupons.length) {
          return res.status(404).json({ message: "No available coupons" });
      }

      res.json({ coupons: availableCoupons });
  } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Server error" });
  }
};



const applyCoupon = async (req, res) => {
console.log("start")
  const { couponCode, totalPrice } = req.body;
  console.log(couponCode,totalPrice)

    try {
        const coupon = await Coupon.findOne({ name: couponCode });
        console.log('1',coupon)

        if (!coupon) {
            return res.status(400).json({ message: "Invalid or expired coupon" });
        }

        if (new Date(coupon.expireOn) < new Date()) {
            console.log('2',new Date(coupon.expireOn),new Date())
            return res.status(400).json({ message: "Coupon has expired" });
        }

        if (totalPrice < coupon.minimumPrice) {
            console.log('3',totalPrice,coupon.minimumPrice)
            return res.status(400).json({ message: `Minimum order price should be ₹${coupon.minimumPrice}` });
        }

        const discount = coupon.offerPrice;
        const finalAmount = totalPrice - discount;
        await  coupon.save()

        console.log('4',discount,finalAmount)

        return res.json({ discount, finalAmount, couponApplied: true });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ message: "Something went wrong" });
    }
};




const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const orderRazorpay = async (req, res) => {
  try {
      console.log("Received request:", req.body);
      const { orderId, subtotal, discount } = req.body;

      // Retrieve the existing order if orderId is provided
      let order;
      if (orderId) {
          order = await Order.findById(orderId);
          if (!order) {
              return res.status(404).json({ success: false, message: "Order not found" });
          }
      }

      if (subtotal === undefined || discount === undefined) {
          return res.status(400).json({ success: false, message: "Subtotal and discount are required" });
      }

      // Calculate totalAmount after applying discount
      const totalAmount = subtotal - discount;

      const options = {
          amount: totalAmount * 100, // Convert to paise
          currency: "INR",
      };
      console.log("Creating Razorpay order with options:", options);
      const razorpayOrder = await razorpayInstance.orders.create(options);
      
      console.log("Order created:", razorpayOrder);
      res.json({
          success: true,
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_ID_KEY,
      });
  } catch (error) {
      console.error("Error in creating Razorpay Order:", error);
      res.status(500).json({
          success: false,
          message: "Failed to create Razorpay order.",
          error: error.message,
      });
  }
};
const verifyRazorPayOrder = async (req, res) => {
  try {
      const { addressId, paymentMethod, couponId, orderId, paymentId, razorpaySignature, cartId, discount } = req.body;
      const userId = req.session.user;
      
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ success: false, message: 'Cart is empty' });
      }
      
      // Verify signature
      const generatedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
          .update(`${orderId}|${paymentId || ''}`)
          .digest("hex");
          
      if (generatedSignature === razorpaySignature) {
          let totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
          
          // Calculate discount
          let discountAmount = 0;
          if (couponId) {
              const coupon = await Coupon.findById(couponId);
              if (coupon) {
                  discountAmount = coupon.offerPrice;
              }
          }

          const finalAmount = totalPrice - discountAmount;

          const newOrder = new Order({
              orderedItems: cart.items.map(item => ({
                  product: item.productId,
                  quantity: item.quantity,
                  price: item.productId.salePrice,
              })),
              userId,
              totalPrice, // Original total before discount
              finalAmount, // Total after discount
              address: addressId,
              invoiceDate: new Date(),
              status: "Pending",
              paymentMethod,
              discount: discountAmount, // Store the discount amount
              user: cart.user,
              paymentStatus: "Paid"
          });

          await newOrder.save();
          cart.items = [];
          await cart.save();
          
          res.status(200).json({ 
              success: true, 
              orderId: newOrder._id, 
              finalAmount,
              discount: discountAmount 
          });
      } else {
          return res.status(400).json({ success: false, message: "Payment verification failed" });
      }
  } catch (error) {
      console.error("Error during payment verification:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const initiateRepayment = async (req, res) => {
  try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId);
      
      if (!order) {
          return res.status(404).json({ success: false, message: "Order not found" });
      }

      const options = {
          amount: order.finalAmount * 100,
          currency: "INR",
      };

      const razorpayOrder = await razorpayInstance.orders.create(options);
      
      res.json({
          success: true,
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_ID_KEY,
      });
  } catch (error) {
      console.error("Error in initiating repayment:", error);
      res.status(500).json({
          success: false,
          message: "Failed to initiate repayment",
          error: error.message,
      });
  }
};

 const cancelOrderItem= async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      const { reason } = req.body;

      console.log("Received cancellation request:");
      console.log("Order ID:", orderId);
      console.log("Item ID:", itemId);
      console.log("Reason:", reason);

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }

      const order = await Order.findById(orderId);
      console.log("order:",order)
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      

      const orderItem = order.orderedItems.find(item => 
        item._id.toString() === itemId
      );

      console.log("orderItem:",orderItem)

      if (!orderItem) {
        return res.status(404).json({
          success: false,
          message: 'Order item not found'
        });
      }
      

      if (order.paymentMethod !== 'cod') {
        const cancelAmount = order.finalAmount;
    console.log(order.finalAmount,'orderItem.finalAmount')
    console.log(cancelAmount,'cancelAmount')


        const transactionType = 'credit';
        const userId = req.session.user;
        await walletHelper.updateWalletBalance(userId, cancelAmount, transactionType);
    }

    await order.save();

      if (orderItem.status === 'Cancelled') {
        return res.status(400).json({
          success: false,
          message: 'This item is already cancelled'
        });
      }

      if (orderItem.status === 'Delivered') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a delivered item'
        });
      }

      orderItem.status = 'Cancelled';
      orderItem.cancellationReason = reason;
      orderItem.cancelledAt = new Date();

      const cancelledItemTotal = orderItem.price * orderItem.quantity;
      order.totalPrice -= cancelledItemTotal;
      
      const allItemsCancelled = order.orderedItems.every(item => 
        item.status === 'Cancelled'
      );
      
      if (allItemsCancelled) {
        order.status = 'Cancelled';
      }

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Order item cancelled successfully'
      });

    } catch (error) {
      console.error('Error in cancelOrderItem:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing cancellation request'
      });
    }
  }
 const returnOrder= async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      const { reason } = req.body;

      console.log("Received return request:");
console.log("Order ID:", req.params.orderId);
console.log("Item ID:", req.params.itemId);
console.log("Reason:", req.body.reason);

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Return reason is required'
        });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        console.error("order not found",orderId)  
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const orderItem = order.orderedItems.find(item => 
        item._id.toString() === itemId
      );
      console.log("Comparing:", orderItem._id.toString(), "vs", String(itemId));


      if (!orderItem) {
        console.error("Order item not found in order:", orderId, "Item ID:", itemId);
        return res.status(404).json({
          success: false,
          message: 'Order item not found'
        });
      }

      if (orderItem.status !== 'Delivered') {
        return res.status(400).json({
          success: false,
          message: 'Only delivered items can be returned'
        });
      }console.log("Order Item Status:", orderItem.status);

      if (orderItem.status === 'Returned' || 
          orderItem.status === 'Return Processing' || 
          orderItem.status === 'Returned') {
        return res.status(400).json({
          success: false,
          message: `Return already ${orderItem.status.toLowerCase()} for this item`
        });
      }

      orderItem.status = 'Returned';
      orderItem.returnReason = reason;
      orderItem.returnRequestedAt = new Date();

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Return request processed successfully'
      });

    } catch (error) {
      console.error('Error in returnOrder:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing return request'
      });
    }
  }

  const walletPayment = async (req, res) => {
    try {
        const { addressId, paymentMethod, couponCode, subtotal, discount, totalAmount, orderId } = req.body;
        console.log("Received wallet payment request:", req.body);

        const userId = req.session.user;
        
        // 1. If there's an orderId, fetch the order instead of relying on cart
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // 2. Verify wallet balance
        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < totalAmount) {
            return res.status(400).json({ message: "Insufficient balance in your wallet" });
        }

        // 3. Process the wallet payment
        const transactionType = 'debit';
        await walletHelper.updateWalletBalance(userId, totalAmount, transactionType);

        // 4. Update order status
        order.paymentStatus = "Paid";
        order.paymentMethod = paymentMethod;
        await order.save();

        // 5. Clear the cart if it hasn't been cleared
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { new: true }
        );

        res.status(200).json({ 
            success: true, 
            orderId: order._id, 
            finalAmount: totalAmount 
        });

    } catch (error) {
        console.error("Error during wallet payment:", error);
        res.status(500).json({ message: "Server error while processing wallet payment" });
    }
};



module.exports = {
  getOrderDetails,
  getOrdersList,
  cancelOrderItem,
  returnOrder,
  getAvailableCoupons,
  applyCoupon,
  orderRazorpay,
  verifyRazorPayOrder,
  walletPayment,
  initiateRepayment

};