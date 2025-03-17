const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require('sqlite3')
const cors = require("cors"); // Import CORS package

const axios = require("axios");
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
  res.json({ isPaid: false }); // Test response
});
// ✅ Route to manually update payment (Simulated Webhook)
app.post("/update-payment", (req, res) => {
    const { isPaid } = req.body;
    if (isPaid) {
        paymentStatus.isPaid = true;
    }
    res.json({ message: "Payment status updated", status: paymentStatus });
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


app.get("/get-product-report/month", async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
      return res.status(400).json({ error: "Month and Year are required!" });
  }

  try {
      const query = `
          SELECT bi.product, 
                 SUM(bi.quantity) AS quantity, 
                 SUM(bi.price) AS price, 
                 SUM(bi.gst) AS gst, 
                 b.date,
           strftime('%m', b.date) AS month 
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          WHERE strftime('%m', b.date) = ? 
          AND strftime('%Y', b.date) = ?
          GROUP BY bi.product, b.date
          ORDER BY b.date DESC
      `;

      const result = await db.all(query, [month, year]); // Pass month and year as parameters
      res.json(result);
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
});

app.get("/get-product-report/day", async (req, res) => {
  const { month, day, year } = req.query;

  if (!day || !year) {
      return res.status(400).json({ error: "Day and Year are required!" });
  }

  try {
    const query = `
    SELECT bi.product, 
           SUM(bi.quantity) AS quantity, 
           SUM(bi.price) AS price, 
           SUM(bi.gst) AS gst, 
           b.date,
           strftime('%m', b.date) AS month
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE strftime('%m', b.date) = ? 
    AND strftime('%d', b.date) = ? 
    AND strftime('%Y', b.date) = ?
    GROUP BY bi.product, b.date
    ORDER BY b.date DESC
`;

const result = await db.all(query, [month.padStart(2, "0"), day.padStart(2, "0"), year]);

      res.json(result);
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
});

// API to Add Loan Details
app.post("/add-loan", (req, res) => {
  const { candidateName, mobileNumber, loanProduct, address, EmulsionsData, createdAt } = req.body;

  if (!candidateName || !mobileNumber || !loanProduct || !address) {
      return res.status(400).json({ error: "All required fields must be filled." });
  }

  let productDetails = "";
  let price = "0";
  let gst = "0";

  if (EmulsionsData?.todoList && EmulsionsData.todoList.length > 0) {
      const item = EmulsionsData.todoList[0]; 
      productDetails = `${item.company} ${item.base} ${item.product} ${item.liters} ${item.quantity}`;
      price = item.price;
      gst = item.gst;
  }

  // ✅ Include the createdAt field in the INSERT query
  const sql = `INSERT INTO loans (candidateName, mobileNumber, loanProduct, address, LoanData, Price, status, GST, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`;  
  const values = [candidateName, mobileNumber, loanProduct, address, productDetails, price, gst, createdAt];

  db.run(sql, values, function (err) {
      if (err) {
          console.error("Error inserting loan:", err);
          return res.status(500).json({ error: "Database error" });
      }
      console.log("Loan record inserted successfully!");
      res.status(201).json({ message: "Loan added successfully", loanId: this.lastID });
  });
});

// API to Fetch All Loans
app.get("/loans", async (req, res) => {
  try {
    const query = `SELECT * FROM loans;`;
    const response = await db.all(query);
 // Debugging

    res.json(response); // ✅ Send response to client
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" }); // ✅ Handle errors properly
  }
});
app.patch("/loans/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
      const result = await db.run("UPDATE loans SET status = ? WHERE id = ?", [status, id]);

      if (result.changes === 0) {
          return res.status(404).json({ error: "Loan not found" });
      }

      res.json({ message: "Loan status updated successfully" });
  } catch (error) {
      console.error("Error updating loan status:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/gloans", async (req, res) => {
  try {
    const query = `SELECT * FROM loans 
where status = 'Closed';`;
    const response = await db.all(query);
 // Debugging

    res.json(response); // ✅ Send response to client
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" }); // ✅ Handle errors properly
  }
});
