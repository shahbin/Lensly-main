const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Wishlist = require("../../models/wishlistSchema");
const Wallet = require("../../models/walletSchema") 
const Category = require("../../models/categorySchema")
const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const { v4: uuidv4 } = require('uuid');
const razorpayInstance = require('../../controllers/user/orderController');
const Coupon = require("../../models/couponSchema");

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.render('cart', { user: null, cartItems: [] });

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', select: 'productImage productName salePrice regularPrice' });

    if (!cart) return res.render('cart', { user, cartItems: [] });

    const cartItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      subtotal: item.quantity * (item.productId.salePrice || item.productId.regularPrice),
      image: item.productId.productImage[0],
      name: item.productId.productName
    }));

    if (!res.locals.cartItems) {
      res.locals.cartItems = cartItems;
      res.render('cart', { user});
    }

  } catch (error) {
    console.error('Cart error:', error);
  }
}

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        status: 'unauthorized', 
        message: 'You need to be logged in to add items to your cart.' 
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, status:'not_found', message: 'Product not found' });
    }

    if (product.quantity === 0) {
      return res.status(200).json({ success: false, status: "out_of_stock", message: 'Product is out of stock' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    const maxQuantity = Math.min(product.quantity, 5);

    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + parseInt(quantity), maxQuantity);
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
    } else {
      cart.items.push({
        productId,
        quantity: Math.min(parseInt(quantity), maxQuantity),
        price: product.salePrice,
        totalPrice: product.salePrice * Math.min(parseInt(quantity), maxQuantity)
      });
    }

    await cart.save();
    res.status(200).json({ success: true, status: 'added', message: 'Item added to cart successfully' });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, status: 'error' , message: 'Failed to add item'});
  }
};


const updateCart = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Product ID' 
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ 
      success: false, 
      message: 'Cart not found' 
    });

    const item = cart.items.find(item => 
      item.productId.toString() === productId
    );

    if (!item) return res.status(404).json({ 
      success: false, 
      message: 'Item not found' 
    });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ 
      success: false, 
      message: 'Product not found' 
    });

    const maxQuantity = Math.min(product.quantity, 5);

    if (action === 'increase') {
      item.quantity = Math.min(item.quantity + 1, maxQuantity);
    } else if (action === 'decrease') {
      item.quantity = Math.max(item.quantity - 1, 1);
    }

    item.totalPrice = item.price * item.quantity;

    await cart.save();

    res.status(200).json({ 
      success: true, 
      availableQuantity: item.quantity,
      availableStock: product.quantity,
      message: 'Quantity updated successfully' 
    });

  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update cart', 
      error: error.message 
    });
  }
}

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(item => 
      item.productId.toString() !== productId
    );

    await cart.save();
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item', error: error.message });
  }
}

const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', select: 'productName salePrice regularPrice productImage' });

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const cartItems = cart.items.map(item => ({
      productId: item.productId._id,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      productImage: item.productId.productImage[0],
      productName: item.productId.productName,
    }));

    let defaultAddress = user.addresses.find((addr) => addr.isDefault);
    if (!defaultAddress && user.addresses.length > 0) {
      defaultAddress = user.addresses[0];
    }

    res.render('checkout', { user, cart: { items: cartItems }, discount: 0, cartItems });

  } catch (error) {
    console.error('Error getting checkout:', error);
    console.log(error.stack); 
  }
}

const placeOrder = async (req, res) => {
  try {
      const { addressId, paymentMethod, subtotal, discount, couponCode } = req.body;
      const userId = req.session.user;
      const deliveryCharge = 49;

      const totalAmount = subtotal - discount + deliveryCharge;

      if (paymentMethod === 'cod' && totalAmount > 1000) {
          return res.status(400).json({ 
              success: false, 
              message: 'Cash on Delivery is not available for orders above ₹1000. Please choose a different payment method.' 
          });
      }

      if (paymentMethod === 'wallet') {
          const wallet = await Wallet.findOne({ userId });
          if (!wallet || wallet.balance < totalAmount) {
              return res.status(400).json({ 
                  success: false, 
                  message: 'Insufficient balance in your wallet' 
              });
          }
      }

      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || !cart.items || cart.items.length === 0) {
          return res.status(400).json({ success: false, message: 'Cart is empty' });
      }

      const quantityErrors = [];
      const blockedProductErrors = [];
      const unlistedCategoryErrors = [];

      for (const item of cart.items) {
        const product = item.productId;
        if (!product) {
            quantityErrors.push(`Product not found in the cart`);
            continue;
        }

        if (product.isBlocked) {
            blockedProductErrors.push(`${product.productName} is currently unavailable.`);
        }

        const category = await Category.findById(product.category);
        if (!category || !category.isListed) {
            unlistedCategoryErrors.push(`${product.productName} is currently unavailable.`);
        }

        if (product.quantity === 0) {
            quantityErrors.push(`${product.productName} is out of stock.`);
        } else if (product.quantity < item.quantity) {
            quantityErrors.push(`Only ${product.quantity} left. You have ${item.quantity} in cart.`);
        }
    }

    if (quantityErrors.length > 0 || blockedProductErrors.length > 0 || unlistedCategoryErrors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Some issues with your cart items.',
            errors: [...quantityErrors, ...blockedProductErrors, ...unlistedCategoryErrors]
        });
    }

      const orderItems = cart.items.map(item => ({
          product: item.productId._id,
          productName: item.productId.productName, 
          productImage: item.productId.images,    
          quantity: item.quantity,
          price: item.productId.salePrice || item.productId.price,
          status: 'Pending' 
      }));

      const order = new Order({
          userId,
          orderedItems: orderItems,
          address: addressId,
          status: 'Pending',
          totalPrice: subtotal,
          discount,
          deliveryCharge,
          finalAmount: totalAmount,
          paymentMethod,
          createdAt: new Date()
      });

      if (paymentMethod === 'cod') {
          order.paymentStatus = "Pending";
      } else if (paymentMethod === 'wallet') {
          order.paymentStatus = "Paid";
      } else {
          order.paymentStatus = "Failed";
      }

      if (couponCode) {
          const coupon = await Coupon.findOne({ name: couponCode });
          order.couponId = coupon._id;
      }

      const savedOrder = await order.save();

      await Promise.all(cart.items.map(async (item) => {
          return Product.findByIdAndUpdate(
              item.productId._id,
              { $inc: { quantity: -item.quantity } },
              { new: true }
          );
      }));

      if (paymentMethod !== 'wallet') {
          await Cart.findOneAndUpdate(
              { userId },
              { $set: { items: [] } },
              { new: true }
          );
      }

      res.status(200).json({ 
          success: true, 
          orderId: savedOrder._id,
          totalAmount
      });

  } catch (error) {
      console.error('Place order error:', error);
      res.status(500).json({ 
          success: false, 
          message: 'Failed to place order', 
          error: error.message 
      });
  }
};


const saveAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressType, name, phone, altPhone, city, landMark, state, pincode } = req.body;

    const errors = validateAddressForm(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const addressData = {
      addressType,
      name,
      phone,
      altPhone,
      city,
      landMark,
      state,
      pincode
    };

    let address;
    if (req.params.id) {
      address = await Address.findOneAndUpdate(
        { userId, "addresses._id": req.params.id },
        { $set: { "addresses.$": addressData } },
        { new: true }
      );
    } else {
      address = await Address.findOneAndUpdate(
        { userId },
        { $push: { addresses: addressData } },
        { new: true, upsert: true }
      );
    }

    res.status(200).json({ success: true, address });

  } catch (error) {
    console.error('Error saving address:', error);
    res.status(500).json({ success: false, message: 'Failed to save address', error: error.message });
  }
};

const validateAddressForm = (formData) => {
  const errors = {};
  const phoneRegex = /^\d{10}$/;
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  const alphaRegex = /^[a-zA-Z\s]+$/;
  const consecutiveZerosRegex = /0{7,}/;

  if (!formData.addressType) {
    errors.addressType = 'Address type is required';
  }
  if (!formData.name) {
    errors.name = 'Name is required';
  } else if (formData.name.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (!alphaRegex.test(formData.name)) {
    errors.name = 'Name must contain only letters and spaces';
  }
  if (!formData.phone) {
    errors.phone = 'Phone number is required';
  } else if (!phoneRegex.test(formData.phone)) {
    errors.phone = 'Phone number must be exactly 10 digits';
  } else if (consecutiveZerosRegex.test(formData.phone)) {
    errors.phone = 'Phone number is invalid';
  }
  if (!formData.altPhone) {
    errors.altPhone = 'Alternative phone number is required';
  } else if (!phoneRegex.test(formData.altPhone)) {
    errors.altPhone = 'Alternative phone number must be exactly 10 digits';
  } else if (consecutiveZerosRegex.test(formData.altPhone)) {
    errors.altPhone = 'Alternative phone number is invalid';
  } else if (formData.phone === formData.altPhone) {
    errors.altPhone = 'Phone number and alternative phone number cannot be the same';
  }
  if (!formData.city) {
    errors.city = 'City is required';
  } else if (!alphaRegex.test(formData.city)) {
    errors.city = 'City must contain only letters and spaces';
  }
  if (!formData.state) {
    errors.state = 'State is required';
  } else if (!alphaRegex.test(formData.state)) {
    errors.state = 'State must contain only letters and spaces';
  }
  if (!formData.pincode) {
    errors.pincode = 'Pincode is required';
  } else if (!pincodeRegex.test(formData.pincode)) {
    errors.pincode = 'Pincode must be a valid 6-digit number';
  }
  if (!formData.landMark) {
    errors.landMark = 'Landmark is required';
  }

  return errors;
};

module.exports = {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  getCheckout,
  placeOrder,
  saveAddress
};
