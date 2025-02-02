const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

const loadSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const reportType = req.query.type || 'custom';
        let startDate = req.query.startDate;
        let endDate = req.query.endDate;

        if (reportType !== 'custom') {
            const now = new Date();
            endDate = now.toISOString();
            
            switch (reportType) {
                case 'daily':
                    startDate = new Date(now.setDate(now.getDate() - 1)).toISOString();
                    break;
                case 'weekly':
                    startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
                    break;
                case 'monthly':
                    startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                    break;
                case 'yearly':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
                    break;
            }
        }

        let query = {
            status: 'Delivered'  
        };
        
        if (startDate && endDate) {
            query.createdOn = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderedItems.product')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const aggregateResult = await Order.aggregate([
            { 
                $match: query
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totalPrice' },
                    totalDiscount: { $sum: '$discount' },
                    totalFinalAmount: { $sum: '$finalAmount' },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        const metrics = aggregateResult[0] || {
            totalSales: 0,
            totalDiscount: 0,
            totalFinalAmount: 0,
            orderCount: 0
        };

        res.render('salesReport', {
            order: orders,
            page,
            totalPage: totalPages,
            metrics,
            reportType,
            startDate,
            endDate
        });

    } catch (error) {
        console.error('Sales Report Error:', error);
        res.redirect("/pageError");
    }
};


const generatePDF = async (orders, metrics) => {
    const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
    });

    // Helper functions
    const formatCurrency = (amount) => `₹${Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    const formatDate = (date) => {
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '-');
    };

    const truncateId = (id) => {
        return id.substring(0, 12) + '...';
    };

    // Header
    doc.fontSize(24)
        .font('Helvetica-Bold')
        .text('SALES REPORT', { align: 'center' });
    
    doc.fontSize(12)
        .font('Helvetica')
        .text(`Generated on: ${new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        })}`, { align: 'center' });
    
    doc.moveDown(2);

    // Summary section
    doc.rect(50, doc.y, 495, 120).stroke();
    
    const startY = doc.y + 10;
    
    // Summary title
    doc.font('Helvetica-Bold')
        .fontSize(16)
        .text('Summary', 70, startY);
    
    // Summary data
    const summaryData = [
        { label: 'Total Orders:', value: metrics.orderCount },
        { label: 'Total Sales:', value: formatCurrency(metrics.totalSales) },
        { label: 'Total Discount:', value: formatCurrency(metrics.totalDiscount) },
        { label: 'Net Amount:', value: formatCurrency(metrics.totalFinalAmount) }
    ];

    let currentY = startY + 30;
    summaryData.forEach(item => {
        doc.font('Helvetica-Bold')
            .fontSize(12)
            .text(item.label, 70, currentY);
        doc.font('Helvetica')
            .text(item.value, 200, currentY);
        currentY += 20;
    });

    doc.moveDown(4);

    // Order Details section
    doc.font('Helvetica-Bold')
        .fontSize(16)
        .text('Order Details', 50, doc.y);
    
    doc.moveDown();

    // Define fixed column widths
    const columns = [
        { header: 'Order ID', width: 140 },
        { header: 'Date', width: 100 },
        { header: 'Customer', width: 120 },
        { header: 'Status', width: 70 },
        { header: 'Amount', width: 65 }
    ];

    const tableTop = doc.y;
    
    // Draw table header background
    doc.rect(50, tableTop, 495, 20)
       .fill('#f0f0f0');

    // Draw header text
    let xPos = 60;
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('#000000');

    columns.forEach(column => {
        doc.text(column.header, xPos, tableTop + 5, {
            width: column.width,
            align: 'left'
        });
        xPos += column.width;
    });

    // Table rows
    let rowTop = tableTop + 25;

    orders.forEach((order, index) => {
        // Alternate row background
        if (index % 2 === 0) {
            doc.rect(50, rowTop - 5, 495, 20)
               .fill('#f9f9f9');
        }

        xPos = 60;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#000000');

        // Order ID (truncated)
        doc.text(truncateId(order.orderId), xPos, rowTop, {
            width: columns[0].width - 10
        });
        xPos += columns[0].width;

        // Date (formatted)
        doc.text(formatDate(order.createdOn), xPos, rowTop, {
            width: columns[1].width - 10
        });
        xPos += columns[1].width;

        // Customer
        doc.text(order.userId.name, xPos, rowTop, {
            width: columns[2].width - 10
        });
        xPos += columns[2].width;

        // Status
        doc.text(order.status, xPos, rowTop, {
            width: columns[3].width - 10
        });
        xPos += columns[3].width;

        // Amount
        doc.text(formatCurrency(order.finalAmount), xPos, rowTop, {
            width: columns[4].width - 10
        });

        rowTop += 20;
    });

    // Draw table border
    doc.rect(50, tableTop, 495, rowTop - tableTop)
       .stroke();

    return doc;
};

const downloadPdf = async (req, res) => {
    try {
        const query = buildDateQuery(req.query);
        query.status = 'Delivered';
        
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderedItems.product');

        const metrics = await calculateMetrics(query);

        const doc = await generatePDF(orders, metrics);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

        doc.pipe(res);
        doc.end();

    } catch (error) {
        console.error('PDF Download Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
};

const downloadExcel = async (req, res) => {
    try {
        const query = buildDateQuery(req.query);
        query.status = 'Delivered';
        
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderedItems.product');

        const workbook = xlsx.utils.book_new();
        
        const worksheetData = orders.map(order => ({
            'Order ID': order.orderId,
            'Date': order.createdOn.toLocaleDateString(),
            'Customer': order.userId.name,
            'Items': order.orderedItems.length,
            'Total Amount': order.totalPrice,
            'Discount': order.discount,
            'Final Amount': order.finalAmount,
            'Payment Status': order.paymentStatus,
            'Order Status': order.status
        }));

        const worksheet = xlsx.utils.json_to_sheet(worksheetData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        const buffer = xlsx.write(workbook, { type: 'buffer' });
        res.send(buffer);

    } catch (error) {
        console.error('Excel Download Error:', error);
        res.status(500).json({ error: 'Failed to generate Excel' });
    }
};

const buildDateQuery = (params) => {
    const query = {};
    if (params.startDate && params.endDate) {
        query.createdOn = {
            $gte: new Date(params.startDate),
            $lte: new Date(params.endDate)
        };
    }
    return query;
};

const calculateMetrics = async (query) => {
    const aggregateResult = await Order.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$totalPrice' },
                totalDiscount: { $sum: '$discount' },
                totalFinalAmount: { $sum: '$finalAmount' },
                orderCount: { $sum: 1 }
            }
        }
    ]);
    return aggregateResult[0] || {
        totalSales: 0,
        totalDiscount: 0,
        totalFinalAmount: 0,
        orderCount: 0
    };
};

module.exports = {
    loadSalesReport,
    downloadPdf,
    downloadExcel
};