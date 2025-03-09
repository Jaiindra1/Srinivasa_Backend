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

app.post("/save-bill", async (req, res) => {
  const { todoList, total, date, time, year } = req.body;
  try {
    const query = `INSERT INTO bills (total_amount, date, time, year) VALUES (?, ?, ?, ?)`;
    const result = await db.run(query, [total, date, time, year]);
    const billId = result.lastID;
    try {
      // Prepare the insert query
      const query = `INSERT INTO bill_items (bill_id, product, Base, Liters, quantity, discount, gst, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      // Iterate over each item and insert separately
      for (const item of todoList) {
          await db.run(query, [
              billId,
              item.product,
              item.base,
              item.liters,
              item.quantity,
              item.discount,
              item.gst,
              item.price
          ]);
      }
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
    res.json({ message: "Bill saved successfully", billId: result.lastID });
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ error: err.message });
  }

});

// Fetch all bills with their items
app.get("/bills", (req, res) => {
  db.all(`SELECT * FROM bills`, (err, bills) => {
      if (err) return res.status(500).json({ message: "Error retrieving bills" });
      const billIds = bills.map((bill) => bill.id);
      if (billIds.length === 0) return res.json([]);
      const placeholders = billIds.map(() => "?").join(",");
      db.all(`SELECT * FROM bill_items WHERE bill_id IN (${placeholders})`, billIds, (err, items) => {
          if (err) return res.status(500).json({ message: "Error retrieving bill items" });
          const billsWithItems = bills.map((bill) => ({
              ...bill,
              items: items.filter((item) => item.bill_id === bill.id),
          }));
          res.json(billsWithItems);
      });
  });
});

