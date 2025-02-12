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
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');



const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;

    const userDetails = await User.findById(userId);
    if (!userDetails) {
      return res.render('order-details', {
        order: null,
        error: 'User not found',
        user: null
      });
    }

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.render('order-details', {
        order: null,
        error: 'Order not found',
        user: userDetails
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
      user: userDetails
    });

  } catch (error) {
    console.error('Order details error:', error);
    res.render('order-details', {
      order: null,
      error: 'Failed to load order details',
      user: null
    });
  }
}

const getOrdersList = async (req, res) => {
  try {
    const userId = req.session.user; 
    
    const userDetails = await User.findById(userId);
    if (!userDetails) {
      return res.render('order-list', {
        orders: [],
        error: 'User not found',
        user: null,
        currentPage: 1,
        totalPages: 0
      });
    }

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
      user: userDetails,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.render('order-list', {
      orders: [],
      error: 'Failed to fetch orders',
      user: null,
      currentPage: 1,
      totalPages: 0
    });
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
        const { orderId, totalAmount } = req.body;
        console.log('Creating Razorpay order for:', req.body);

        const order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const amount = Math.round(parseFloat(totalAmount) * 100);
        if (isNaN(amount)) {
            throw new Error('Invalid amount');
        }

        const options = {
            amount: amount,
            currency: "INR",
            receipt: orderId.toString(),
            payment_capture: 1 
        };

        console.log("Creating Razorpay order with options:", options);
        const razorpayOrder = await razorpayInstance.orders.create(options);
        
        if (!razorpayOrder) {
            throw new Error('Failed to create Razorpay order');
        }

        console.log("Razorpay order created:", razorpayOrder);
        
        await Order.findByIdAndUpdate(orderId, {
            razorpayOrderId: razorpayOrder.id
        });

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
    let order;
    try {
        const { orderId, razorpayOrderId, paymentId, razorpaySignature, order_id  } = req.body;
        console.log('Verifying payment:', req.body);

        order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
            .update(order_id + '|' + paymentId)
            .digest('hex');

        console.log('Signature verification:', {
            expected: generatedSignature,
            received: razorpaySignature,
            match: generatedSignature === razorpaySignature
        });

        const isValid = generatedSignature === razorpaySignature;

        if (!isValid) {
            console.log('Signature verification failed');
            order.paymentStatus = "Failed";
            await order.save();
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid payment signature'
            });
        }

        const payment = await razorpayInstance.payments.fetch(paymentId);
        console.log('Razorpay payment details:', payment);

        if (payment.status === 'captured') {
            order.paymentStatus = "Paid";
            order.paymentMethod = "online";
            await order.save();

            console.log('Order updated successfully:', order);
            return res.status(200).json({ 
                success: true, 
                message: "Payment verified successfully"
            });
        } else {
            order.paymentStatus = "Failed";
            await order.save();
            return res.status(400).json({ 
                success: false, 
                message: 'Payment not captured'
            });
        }
    } catch (error) {
        console.error("Error during payment verification:", error);
        
        if (order) {
            order.paymentStatus = "Failed";
            await order.save();
            console.log('Order status updated to failed:', order);
        }

        res.status(400).json({ 
            success: false, 
            message: error.message || "Payment verification failed"
        });
    }
};

const initiateRepayment = async (req, res) => {
    try {
        const { orderId } = req.params
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.paymentStatus !== "Failed" && order.paymentStatus !== "Pending") {
            return res.status(400).json({ success: false, message: "Payment is already completed" });
        }

        console.log(order)

        const options = {
            amount: order.finalAmount * 100,
            currency: "INR",
            receipt: orderId,
        };

        console.log(options)        

        const razorpayOrder = await razorpayInstance.orders.create(options);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_ID_KEY,
            orderDetails: {
                id: order._id,
                receipt: orderId,
            }
        });

    } catch (error) {
        console.error("Error in initiating repayment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to initiate repayment",
            error: error.message
        });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const orderItem = order.orderedItems.find(item => 
            item._id.toString() === itemId
        );


        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

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
        order.finalAmount -= cancelledItemTotal;

        if (order.paymentMethod !== 'cod') {
            const cancelAmount = orderItem.price * orderItem.quantity;
            const transactionType = 'credit';
            const userId = req.session.user;
            await walletHelper.updateWalletBalance(userId, cancelAmount, transactionType);
        }

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
const returnOrder = async (req, res) => {
  try {
      const { orderId, itemId } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
          return res.status(400).json({
              success: false,
              message: 'Return reason is required'
          });
      }

      const order = await Order.findById(orderId);
      if (!order) {
          console.error("order not found", orderId)
          return res.status(404).json({
              success: false,
              message: 'Order not found'
          });
      }

      const orderItem = order.orderedItems.find(item =>
          item._id.toString() === itemId
      );

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
      }

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

      // Process wallet credit for return regardless of original payment method
      const returnAmount = orderItem.price * orderItem.quantity;
      const transactionType = 'credit';
      const userId = req.session.user;
      await walletHelper.updateWalletBalance(userId, returnAmount, transactionType);

      const allItemsReturned = order.orderedItems.every(item => 
        item.status === 'Returned'
    );

    if (allItemsReturned) {
        order.status = 'Returned';
    }


    const ReturnedItemTotal = orderItem.price * orderItem.quantity;
        order.totalPrice -= ReturnedItemTotal;
        order.finalAmount -= ReturnedItemTotal;

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
        const { orderId, amount, paymentMethod } = req.body;
  
        const userId = req.session.user;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ message: "Insufficient balance in your wallet" });
        }

        const transactionType = 'debit';
        await walletHelper.updateWalletBalance(userId, order.finalAmount , transactionType);

        order.paymentStatus = "Paid";
        order.paymentMethod = paymentMethod;
        await order.save();

        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { new: true }
        );

        res.status(200).json({ 
            success: true, 
            orderId: order._id, 
            finalAmount: amount 
        });

    } catch (error) {
        console.error("Error during wallet payment:", error);
        res.status(500).json({ message: "Server error while processing wallet payment" });
    }
};



const updatePaymentMethod = async (req, res) => {
    try {
        const { orderId, paymentMethod, paymentStatus } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.paymentMethod = paymentMethod;
        order.paymentStatus = paymentStatus;
        await order.save();

        res.json({
            success: true,
            message: 'Payment method updated successfully'
        });
    } catch (error) {
        console.error('Error updating payment method:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment method',
            error: error.message
        });
    }
};

const generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('userId', 'name email phone');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const address = await Address.findOne({ 
      userId: order.userId._id,
      'addresses._id': order.address 
    }, { 
      'addresses.$': 1 
    });

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Lensly-Invoice-${orderId}.pdf`);

    doc.pipe(res);

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(amount || 0).replace('₹', '₹');
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    doc.fontSize(24)
      .font('Helvetica-Bold')
      .text('Lensly', { align: 'center' })
      .fontSize(12)
      .font('Helvetica')
      .text('Premium Camera Store', { align: 'center' })
      .moveDown(0.5);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('TAX INVOICE', { align: 'center' })
      .moveDown(0.5);

    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
      .moveDown(1);

    const companyStartY = doc.y;
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('From:', 50, companyStartY)
      .font('Helvetica')
      .moveDown(0.3)
      .text('Lensly Camera Store')
      .text('123 Photography Street')
      .text('Bangalore, Karnataka - 560001')
      .text('Phone: +91 9876543210')
      .text('Email: support@lensly.com')
      .text('GSTIN: 29ABCDE1234F1Z5');

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Details:', 300, companyStartY)
      .font('Helvetica')
      .moveDown(0.3)
      .text(`Invoice Number: INV-${orderId.slice(-6).toUpperCase()}`)
      .text(`Order Date: ${formatDate(order.createdOn)}`)
      .text(`Invoice Date: ${formatDate(new Date())}`)
      .text(`Payment Method: ${order.paymentMethod}`)
      .text(`Payment Status: ${order.paymentStatus}`);

    doc.moveDown(1.5);
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('Bill To / Ship To:', 50)
      .font('Helvetica')
      .moveDown(0.3);

    if (address && address.addresses && address.addresses[0]) {
      const addr = address.addresses[0];

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .text(addr.name || '')
         .moveDown(1.5);
      
      if (addr.landMark) {
        doc.save()
           .rect(50, doc.y, 200, 25)
           .fill('#f8fafc');
        
        doc.fillColor('#4a5568')
           .font('Helvetica')
           .fontSize(10)
           .text('Landmark: ' + addr.landMark, 60, doc.y - 20)
           .moveDown(0.3);
        
        doc.restore();
      }
      
      doc.font('Helvetica')
         .fontSize(10)
         .text(`${addr.city}, ${addr.state} - ${addr.pincode}`)
         .moveDown(0.3);

      doc.font('Helvetica')
         .text('Phone:', { continued: true, width: 150 })
         .font('Helvetica-Bold')
         .text(` ${addr.phone}`)
         .moveDown(0.2);
      
      if (addr.altPhone) {
        doc.font('Helvetica')
           .text('Alt Phone:', { continued: true, width: 150 })
           .font('Helvetica-Bold')
           .text(` ${addr.altPhone}`)
           .moveDown(0.2);
      }
      
      doc.font('Helvetica')
         .text('Email:', { continued: true, width: 180 })
         .font('Helvetica-Bold')
         .text(` ${order.userId.email}`);
    }

    doc.moveDown(1.5)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Order Items')
      .moveDown(0.5);

    const tableTop = doc.y;
    doc.font('Helvetica-Bold')
      .fontSize(10);

    doc.rect(50, tableTop, 500, 20).fill('#f0f0f0');
    doc.fillColor('black')
      .text('Product', 60, tableTop + 5, { width: 250 })
      .text('Price', 320, tableTop + 5, { width: 70 })
      .text('Qty', 390, tableTop + 5, { width: 40 })
      .text('Total', 460, tableTop + 5, { width: 80 });

    let y = tableTop + 25;
    doc.font('Helvetica');
    
    order.orderedItems.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y - 5, 500, 25).fill('#f9f9f9');
      }
      
      doc.fillColor('black')
        .fontSize(9)
        .text(item.product.productName, 60, y, { width: 250 })
        .text(formatCurrency(item.price), 320, y)
        .text(item.quantity.toString(), 390, y)
        .text(formatCurrency(item.price * item.quantity), 460, y);
      y += 25;
    });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 20;

    const subtotal = order.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = order.discount || 0;
    const shipping = order.shippingCharge || 49;
    const finalTotal = subtotal - discount + shipping;

    const summaryX = 350;
    const valueX = 480;
    
    doc.font('Helvetica')
      .fontSize(10)
      .text('Summary:', summaryX, y)
      .moveDown(0.5);

    y += 15;
    doc.text('Subtotal:', summaryX, y)
      .text(formatCurrency(subtotal), valueX, y);
    
    y += 20;
    doc.text('Shipping:', summaryX, y)
      .text(formatCurrency(shipping), valueX, y);
    
    y += 20;
    doc.text('Discount:', summaryX, y)
      .text(`-${formatCurrency(discount)}`, valueX, y);

    y += 25;
    doc.rect(340, y - 5, 210, 25).fill('#f0f0f0');
    doc.fillColor('black')
      .font('Helvetica-Bold')
      .text('Total Amount:', summaryX, y)
      .text(formatCurrency(finalTotal), valueX, y);

    doc.moveDown(2)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Terms & Conditions:', 50)
      .font('Helvetica')
      .fontSize(8)
      .moveDown(0.5)
      .text('1. All prices are inclusive of GST where applicable.')
      .text('2. This is a computer-generated invoice and does not require a physical signature.')
      .text('3. For return/exchange policy, please visit our website www.lensly.com')
      .text('4. For any queries regarding this invoice, please contact our support team.')
      .moveDown(1);

    doc.fontSize(8)
      .text('Thank you for shopping with Lensly!', { align: 'center' })
      .moveDown(0.5)
      .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
        .text(
          `Page ${i + 1} of ${pages.count}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
    }
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
};
module.exports = {
  getOrderDetails,
  getOrdersList,
  orderRazorpay,
  verifyRazorPayOrder,
  initiateRepayment,
  cancelOrderItem,
  returnOrder,
  walletPayment,
  updatePaymentMethod,
  generateInvoice,
  getAvailableCoupons,
  applyCoupon
};