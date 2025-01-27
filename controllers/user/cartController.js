const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const { v4: uuidv4 } = require('uuid');

// Get Cart
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
      res.render('cart', { user, cartItems });
    }

  } catch (error) {
    console.error('Cart error:', error);
    // Do not send a response to the client with the error message
  }
}

// Add to Cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId
    );

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
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item', error: error.message });
  }
}

// Update Cart
const updateCart = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.session.user;

    // Validate ObjectId
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

// Remove from Cart
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
      productName: item.productId.productName
    }));

    res.render('checkout', { user, cart: { items: cartItems }, discount: 0, cartItems });

  } catch (error) {
    console.error('Error getting checkout:', error);
    console.log(error.stack); // Log the error stack
    // Do not send a response to the client with the error message
  }
}

const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.user;
 
    const address = await Address.findOne({ 
      userId: userId, 
      "addresses._id": addressId 
    });
 
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid address'
      });
    }
 
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
 
    const orderItems = cart.items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.price
    }));
 
    const order = new Order({
      userId,
      orderedItems: orderItems,
      address: addressId,
      status: 'Pending',
      totalPrice: cart.items.reduce((total, item) => total + item.totalPrice, 0),
      finalAmount: cart.items.reduce((total, item) => total + item.totalPrice, 0) + 49,
      paymentMethod
    });
 
    await order.save();
 
    const productUpdates = cart.items.map(item => 
      Product.findByIdAndUpdate(item.productId, { 
        $inc: { quantity: -item.quantity } 
      })
    );
    await Promise.all(productUpdates);
 
    await Cart.deleteOne({ userId });
 
    res.status(200).json({ success: true, orderId: order._id });
 
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order', error: error.message });
  }
}



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
