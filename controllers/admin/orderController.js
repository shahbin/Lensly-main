const Order = require('../../models/orderSchema');

const getAllOrders = async (req, res) => {
    console.log('getAllOrders');
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    try {
        const orders = await Order.find()
            .populate('orderedItems.product')
            .populate('address')
            .sort({ orderDate: -1 }) 
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


module.exports = {
    getAllOrders,
    updateOrderStatus
}