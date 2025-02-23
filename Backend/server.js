const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cloudinary = require('./cloudinaryConfig');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Cloudinary ENV:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('Mongo URI:', process.env.MONGO_URI);

const upload = multer({ dest: 'uploads/' });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error('❌ MONGO_URI is missing in .env file!');
    process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB connection error:', err));

const itemSchema = new mongoose.Schema({
    category: String,
    item: String,
    price: Number,
    picture: String,
    soldOut: Boolean
});
const orderSchema = new mongoose.Schema({
    items: Array,
    total: Number,
    date: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);
const Order = mongoose.model('Order', orderSchema);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/add-item', upload.single('picture'), async (req, res) => {
    try {
        const { category, item, price } = req.body;
        const picture = req.file;

        if (!category || !item || !price || !picture) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const uploadResult = await cloudinary.uploader.upload(picture.path, { folder: 'items' });
        fs.unlinkSync(picture.path);

        const newItem = new Item({
            category,
            item,
            price: parseFloat(price),
            picture: uploadResult.secure_url,
            soldOut: false
        });

        await newItem.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json({ items });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/remove-item', async (req, res) => {
    try {
        const { id } = req.body;
        await Item.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/toggle-sold-out', async (req, res) => {
    try {
        const { id } = req.body;
        const foundItem = await Item.findById(id);

        if (!foundItem) return res.status(404).json({ success: false, message: 'Item not found' });

        foundItem.soldOut = !foundItem.soldOut;
        await foundItem.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/checkout', async (req, res) => {
    try {
        const { cart } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty or invalid' });
        }

        const total = cart.reduce((sum, item) => sum + item.price, 0);
        const newOrder = new Order({ items: cart, total });

        await newOrder.save();
        res.json({ success: true, message: 'Order placed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json({ orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Not Found' }));

app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
