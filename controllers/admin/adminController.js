const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const Order = require("../../models/orderSchema")
const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")

const pageError = async (req,res)=>{
    res.render('admin-error')
}

const loadLogin = (req, res) => {
    try {
        if (req.session?.admin) {
            return res.redirect("/admin/dashboard");
        }
        res.render("admin-login", { message: null });
    } catch (error) {
        console.error('Load login error:', error);
        res.status(500).render("admin-login", { message: "An error occurred" });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.render('admin-login', { message: 'Email and password are required' });
        }

        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.render('admin-login', { message: 'Admin not found' });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        
        if (!passwordMatch) {
            return res.render('admin-login', { message: 'Invalid password' });
        }

        // Store admin details in session
        req.session.admin = {
            id: admin._id,
            email: admin.email,
            isAdmin: true
        };

        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        return res.render('admin-login', { message: 'An error occurred during login' });
    }
};

const loadDashboard = async (req, res) => {
    try {
        const timezone = "Asia/Kolkata";
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setHours(0, 0, 0, 0);
        const previousMonth = new Date(lastMonth);
        previousMonth.setMonth(previousMonth.getMonth() - 1);

        // Time ranges for different periods
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        const lastYear = new Date(today);
        lastYear.setFullYear(today.getFullYear() - 1);

        // Revenue Metrics
        const [currentMonthRevenue, previousMonthRevenue, topProducts, topCategories, productTrends, categoryData] = await Promise.all([
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: lastMonth } } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]),
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: previousMonth, $lt: lastMonth } } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]),
            // Top selling products
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: lastMonth } } },
                { $unwind: "$orderedItems" },
                { $group: {
                    _id: "$orderedItems.product",
                    totalSold: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
                }},
                { $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productInfo"
                }},
                { $unwind: "$productInfo" },
                { $project: {
                    name: "$productInfo.productName",
                    totalSold: 1,
                    revenue: 1,
                    image: { 
                        $cond: {
                            if: { $isArray: "$productInfo.productImage" },
                            then: { $arrayElemAt: ["$productInfo.productImage", 0] },
                            else: null
                        }
                    }
                }},
                { $sort: { revenue: -1 } },
                { $limit: 5 }
            ]),
            // Top categories
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: lastMonth } } },
                { $unwind: "$orderedItems" },
                { $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }},
                { $unwind: "$productInfo" },
                { $group: {
                    _id: "$productInfo.category",
                    totalSales: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } },
                    totalOrders: { $sum: 1 }
                }},
                { $sort: { totalSales: -1 } },
                { $limit: 5 }
            ]),
            // Top selling products with trends
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
                { $unwind: "$orderedItems" },
                { $group: {
                    _id: {
                        product: "$orderedItems.product",
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } }
                    },
                    dailySales: { $sum: "$orderedItems.quantity" },
                    dailyRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
                }},
                { $group: {
                    _id: "$_id.product",
                    salesData: {
                        $push: {
                            date: "$_id.date",
                            sales: "$dailySales",
                            revenue: "$dailyRevenue"
                        }
                    },
                    totalSold: { $sum: "$dailySales" },
                    totalRevenue: { $sum: "$dailyRevenue" }
                }},
                { $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productInfo"
                }},
                { $unwind: "$productInfo" },
                { $project: {
                    name: "$productInfo.name",
                    salesData: 1,
                    totalSold: 1,
                    totalRevenue: 1,
                    images: "$productInfo.images"
                }},
                { $sort: { totalRevenue: -1 } },
                { $limit: 5 }
            ]),
            // Category data for doughnut chart
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: lastMonth } } },
                { $unwind: "$orderedItems" },
                { $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }},
                { $unwind: "$productInfo" },
                { $lookup: {
                    from: "categories",
                    localField: "productInfo.category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }},
                { $unwind: "$categoryInfo" },
                { $group: {
                    _id: "$categoryInfo._id",
                    name: { $first: "$categoryInfo.name" },
                    totalOrders: { $sum: 1 },
                    revenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
                }},
                { $sort: { revenue: -1 } },
                { $limit: 5 }
            ])
        ]);

        // Calculate metrics
        const currentRevenue = currentMonthRevenue[0]?.total || 0;
        const prevRevenue = previousMonthRevenue[0]?.total || 0;
        const revenueChange = prevRevenue ? 
            ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0;

        // Customer Metrics
        const [currentMonthCustomers, previousMonthCustomers, customerStats] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: lastMonth, $lt: today } }),
            User.countDocuments({ createdAt: { $gte: previousMonth, $lt: lastMonth } }),
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [
                                    { $gte: ["$lastLogin", lastMonth] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        const customerChange = previousMonthCustomers ? 
            ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers * 100).toFixed(1) : 0;

        // Order Metrics
        const [orderStats, recentOrders] = await Promise.all([
            Order.aggregate([
                {
                    $facet: {
                        "monthly": [
                            { $match: { createdOn: { $gte: lastMonth } } },
                            { $group: {
                                _id: "$status",
                                count: { $sum: 1 }
                            }}
                        ],
                        "previous": [
                            { $match: { createdOn: { $gte: previousMonth, $lt: lastMonth } } },
                            { $group: {
                                _id: "$status",
                                count: { $sum: 1 }
                            }}
                        ]
                    }
                }
            ]),
            // Recent orders
            Order.find()
                .sort({ createdOn: -1 })
                .limit(10)
                .populate('userId', 'name email')
        ]);

        // Time series data for charts
        const [dailyData, weeklyData, monthlyData, yearlyData] = await Promise.all([
            // Daily data (last 30 days)
            Order.aggregate([
                {
                    $match: {
                        status: "Delivered",
                        createdOn: { $gte: lastMonth }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdOn",
                                    timezone
                                }
                            }
                        },
                        revenue: { $sum: "$finalAmount" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { "_id.date": 1 } }
            ]),
            // Weekly data (last 12 weeks)
            Order.aggregate([
                {
                    $match: {
                        status: "Delivered",
                        createdOn: { $gte: new Date(today.getTime() - (84 * 24 * 60 * 60 * 1000)) } // 12 weeks ago
                    }
                },
                {
                    $group: {
                        _id: {
                            week: { $week: "$createdOn" },
                            year: { $year: "$createdOn" }
                        },
                        revenue: { $sum: "$finalAmount" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.week": 1 } }
            ]),
            // Monthly data (last 12 months)
            Order.aggregate([
                {
                    $match: {
                        status: "Delivered",
                        createdOn: { $gte: lastYear }
                    }
                },
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdOn" },
                            year: { $year: "$createdOn" }
                        },
                        revenue: { $sum: "$finalAmount" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            // Yearly data
            Order.aggregate([
                {
                    $match: {
                        status: "Delivered"
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdOn" }
                        },
                        revenue: { $sum: "$finalAmount" },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1 } }
            ])
        ]);

        // Recent Sales
        const recentSales = await Order.find({ status: "Delivered" })
            .sort({ createdOn: -1 })
            .limit(5)
            .populate('userId', 'name email')
            .select('userId finalAmount createdOn orderedItems');

        // Prepare dashboard data
        const dashboardData = {
            revenue: {
                current: currentRevenue,
                change: revenueChange,
                timeSeriesData: {
                    daily: dailyData,
                    weekly: weeklyData,
                    monthly: monthlyData,
                    yearly: yearlyData
                }
            },
            customers: {
                new: currentMonthCustomers,
                change: customerChange,
                total: customerStats[0]?.total || 0,
                active: customerStats[0]?.active || 0
            },
            orders: {
                stats: orderStats[0],
                recent: recentOrders
            },
            products: {
                top: topProducts,
                trends: productTrends,
                categories: categoryData
            },
            recentSales: recentSales
        };

        res.render('dashboard', { dashboardData });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).render('error', { 
            message: 'Error loading dashboard', 
            error: process.env.NODE_ENV === 'development' ? error : {} 
        });
    }
};

const logout = (req,res)=>{
    try {
        req.session.admin = false
        res.redirect('/admin')
    } catch (error) {
        console.log(error.message);
    }
}

module.exports = {
    pageError,
    loadLogin,
    login,
    loadDashboard,
    logout
}