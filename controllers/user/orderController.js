const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Product = require('../../models/productSchema')
const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const Razorpay = require('razorpay');
const dotenv = require("dotenv")
dotenv.config()
const crypto = require("crypto");

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
      const { totalAmount } = req.body;

      if (!totalAmount) {
          return res.status(400).json({ success: false, message: "Total amount is required" });
      }

      const options = {
          amount: totalAmount * 100,
          currency: "INR",
      };

      console.log("Creating Razorpay order with options:", options);
      const order = await razorpayInstance.orders.create(options);
      
      console.log("Order created:", order);

      res.json({
          success: true,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
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
    
      const { addressId, paymentMethod, couponId, orderId, paymentId, razorpaySignature, cartId } = req.body;
      const userId = req.session.user;
      console.log("start",userId);
      console.log("cart id",req.body)
      

      // if (!cartId) {
      //     return res.status(400).json({ success: false, message: "Cart ID is missing" });
      // }

      // Check if the cart exists
      const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
      

      // Verify the signature
      const generatedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
          .update(`${orderId}|${paymentId || ''}`)
          .digest("hex");
          console.log("generated",generatedSignature,"hh",razorpaySignature);
          

      if (generatedSignature === razorpaySignature) {
          // Continue with order processing
          let coupon = 0;
          if (couponId) {
              coupon = await Coupon.findById({ _id: couponId });
          }

          let totalPrice = 0;
          const user = cart.user;
          for (let item of cart.items) {
              const product = item.productId;
              const quantity = item.quantity;
              
              console.log("zuiii",product)
              console.log("uiii",quantity)

              if (product.quantity < quantity) {
                  return res.status(400).send(`Not enough stock for product ${product.name}`);
              }
              product.quantity -= quantity;
              await product.save();

              totalPrice += product.salePrice * quantity;
          }

          let discount = 0;
          if (coupon) {
              discount = coupon.offerPrice;
              totalPrice = totalPrice - discount;
          }

          const finalAmount = totalPrice;
          const newOrder = new Order({
              orderedItems: cart.items.map(item => ({
                  product: item.productId,
                  quantity: item.quantity,
                  price: item.productId.salePrice,
              })),
              userId,
              totalPrice:cart.items.reduce((total, item) => total + item.totalPrice, 0),
              finalAmount,
              address: addressId,
              invoiceDate: new Date(),
              status: "Pending",  // Change status to "paid" after payment verification
              paymentMethod,
              discount,
              user,
              paymentStatus:"Paid"
          });

          await newOrder.save();
          cart.items = [];
          await cart.save();

          res.status(200).json({ success: true, orderId: newOrder._id, finalAmount });
      } else {
          return res.status(400).json({ success: false, message: "Payment verification failed" });
      }
  } catch (error) {
      console.error("Error during payment verification:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};





module.exports = {
  getOrderDetails,
  getOrdersList,
  cancelOrderItem,
  getAvailableCoupons,
  applyCoupon,
  orderRazorpay,
  verifyRazorPayOrder

};