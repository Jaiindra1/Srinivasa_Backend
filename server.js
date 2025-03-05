const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require('sqlite3')
const cors = require("cors"); // Import CORS package

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all requests

// Database connection
const dbPath = path.join(__dirname, "shop_billing.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(5000, () => {
      console.log("Server Running at http://localhost:5000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// ✅ Sample API Route
app.get('/Products', async (req, res) => {
    const query = `SELECT * FROM Products;`;
    const result = await db.all(query);
    console.log('Fetching Products.....');
    res.json(result); // Send the actual database data
});

app.get("/BaseOptions/:id", async (req, res) => {
      const { id } = req.params; // Extract Product ID from request params
      const query = `select * from Paints where Productid = ${id} `;  
      const result = await db.all(query);
      res.json(result)
      console.log('data sent')
});


let paymentStatus = { isPaid: false }; // ✅ Store payment status

// ✅ Route to get payment status
app.get("/payment-status", (req, res) => {
    res.json(paymentStatus);
});

// ✅ Route to manually update payment (Simulated Webhook)
app.post("/update-payment", (req, res) => {
    const { isPaid } = req.body;
    if (isPaid) {
        paymentStatus.isPaid = true;
    }
    res.json({ message: "Payment status updated", status: paymentStatus });
});

// ✅ Reset payment status (For testing)
app.post("/reset-payment", (req, res) => {
    paymentStatus.isPaid = false;
    res.json({ message: "Payment reset" });
});
