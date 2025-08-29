const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require('cors');
const fs = require('fs').promises; 
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); 
const app = express();
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const API_URL = process.env.REACT_APP_API_URL; 

const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
   
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.post("/api/save-token", async (req, res) => {
  const { employee_id, token } = req.body;

  console.log("🟢 Save token request:", { employee_id, token });

  // Validate input
  if (!employee_id || !token) {
    console.warn("⚠️ Missing employee_id or token:", { employee_id, token });
    return res.status(400).json({ success: false, message: "employee_id and token are required" });
  }

  try {
    // Start a transaction to ensure both updates succeed or fail together
    await pool.query("BEGIN");

    // Update employee_master
    const employeeResult = await pool.query(
      `UPDATE employee_master SET fcm_token = $1 WHERE employee_id = $2 RETURNING employee_id`,
      [token, employee_id]
    );

    // Update qc_master
    const qcResult = await pool.query(
      `UPDATE qc_master SET fcm_token = $1 WHERE employee_id = $2 RETURNING employee_id`,
      [token, employee_id]
    );

    // Commit the transaction
    await pool.query("COMMIT");

    // Log results
    if (employeeResult.rowCount > 0) {
      console.log("✅ FCM token saved in employee_master for", employee_id);
    } else {
      console.warn("⚠️ Employee not found in employee_master:", employee_id);
    }

    if (qcResult.rowCount > 0) {
      console.log("✅ FCM token saved in qc_master for", employee_id);
    } else {
      console.warn("⚠️ Employee not found in qc_master:", employee_id);
    }

    if (employeeResult.rowCount === 0 && qcResult.rowCount === 0) {
      console.warn("⚠️ Employee not found in either table:", employee_id);
      return res.status(404).json({ success: false, message: "Employee not found in employee_master or qc_master" });
    }

    res.status(200).json({ success: true, message: "FCM token saved successfully" });
  } catch (err) {
    // Roll back the transaction on error
    await pool.query("ROLLBACK");
    console.error("❌ Error saving FCM token:", err.message, err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Send notification using `data` to avoid Firebase auto-display duplication
app.post("/api/send-notification", async (req, res) => {
  const { employee_id, title, body } = req.body;

  if (!employee_id || !title || !body) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const result = await pool.query(
      "SELECT fcm_token FROM employee_master WHERE employee_id = $1",
      [employee_id]
    );

    if (result.rows.length === 0 || !result.rows[0].fcm_token) {
      return res.status(404).json({ error: "FCM token not found for this employee" });
    }

    const token = result.rows[0].fcm_token;

    // ✅ Use `data` instead of `notification` to avoid duplicate popups
    const message = {
      token,
      data: {
        title,
        body,
      },
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ send-notification error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Utility: Format date as DD-MM-YYYY
const formatDateDDMMYYYY = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};



// ✅ Allow preflight requests for all routes
app.options("*", (_req, res) => {
  res.sendStatus(200);
});

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "public/uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname); 
    
    cb(null, uniqueName);
  },
});
const upload = multer({ storage: storage });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.json({ filePath: `/uploads/${req.file.filename}` });
});


// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log("Connected to database successfully"))
  .catch((err) => console.error("Database connection error:", err));


  
// JWT Secret Key
const secretKey = process.env.JWT_SECRET_KEY || "your_jwt_secret_key";

// Function to Insert Log Entry
const logEvent = async (event, description) => {
  try {
    await pool.query("INSERT INTO logs (event, description) VALUES ($1, $2)", [
      event,
      description,
    ]);
  } catch (error) {
    console.error("Error inserting log:", error);
  }
};

// Middleware to check permissions
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(403).json({ success: false, message: "No token provided" });

      jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid or expired token" });

        req.user = decoded;
        const { permissions } = decoded;
        const hasPermission = requiredPermissions.every((permission) => permissions.includes(permission));

        if (!hasPermission) {
          return res.status(403).json({ success: false, message: "Permission denied" });
        }

        next();
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
};


app.post("/api/login", async (req, res) => {
  const { employeeId, password } = req.body;

  try {
    // Step 1: Fetch user
    const userQuery = `
      SELECT em.employee_id, em.employee_name, em.role_id, rm.role_name, em.password
      FROM employee_master em
      JOIN role_master rm ON em.role_id = rm.role_id
      WHERE em.employee_id = $1
    `;
    const userResult = await pool.query(userQuery, [employeeId]);

    if (userResult.rows.length === 0) {
      await logEvent("Login Failed", `Invalid login attempt: Employee ID ${employeeId} not found.`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // ✅ Check if password is set
    if (!user.password) {
      await logEvent("Login Failed", `Password not set for Employee ID: ${employeeId}`);
      return res.status(400).json({ success: false, message: "Password not set. Please reset your password." });
    }

    // Step 2: Compare the provided password with the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await logEvent("Login Failed", `Invalid login attempt for Employee ID: ${employeeId}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Step 3: Fetch permissions
    const permissionQuery = `
      SELECT p.permission_id, p.permission_name 
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      WHERE rp.role_id = $1
    `;
    const permissionResult = await pool.query(permissionQuery, [user.role_id]);
    const permissions = permissionResult.rows.map(row => row.permission_id);

    // Step 4: Fetch menus
    const menuQuery = `
      SELECT m.menu_id, m.menu_name 
      FROM role_menu rm 
      JOIN menu_master m ON rm.menu_id = m.menu_id
      WHERE rm.role_id = $1
    `;
    const menuResult = await pool.query(menuQuery, [user.role_id]);
    const menus = menuResult.rows;

    if (menus.length === 0) {
      await logEvent("Login Failed", `User ${employeeId} has no menu access.`);
      return res.status(403).json({ success: false, message: "No menus assigned for this role" });
    }

    // Step 5: Create JWT token
    const payload = {
      employeeId: user.employee_id,
      employeeName: user.employee_name,
      role: user.role_name,
      permissions,
      menus
    };
    const token = jwt.sign(payload, secretKey, { expiresIn: "10m" });

    // Step 6: Log and respond
    await logEvent("User Login", `User ${employeeId} (${user.employee_name}) logged in successfully.`);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      employeeName: user.employee_name,
      employeeId: user.employee_id,
      role: user.role_name,
      permissions,
      menus
    });
  } catch (error) {
    console.error("Login Error:", error);
    await logEvent("Server Error", `Error during login for Employee ID: ${employeeId}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



app.get("/api/employees", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employee_master WHERE role_id != 4");

    await logEvent("Fetch Employees", "User retrieved employee list.");
    res.status(200).json(result.rows);
  } catch (err) {
    await logEvent("Server Error", "Error retrieving employee list.");
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//  trade_master
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM trade_master");
 // Log successful retrieval of trades
 await logEvent("Fetch Trades", "User retrieved trade list.");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching trades:", error);
    // Log error if query fails
    await logEvent("Server Error", "Error retrieving trade list.");
    res.status(500).json({ error: "Server error fetching trades" });
  }
});


//  trade_master
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM trade_master");
 // Log successful retrieval of trades
 await logEvent("Fetch Trades", "User retrieved trade list.");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching trades:", error);
    // Log error if query fails
    await logEvent("Server Error", "Error retrieving trade list.");
    res.status(500).json({ error: "Server error fetching trades" });
  }
});

// Add a new employee (requires 'create' permission, ID: 2)
app.post('/api/employees', checkPermission([2]), async (req, res) => {
  const { employee_id, employee_name, designation, email_id, phone_number } = req.body;
  if (!employee_id || !employee_name || !designation || !email_id || !phone_number) {
    await logEvent("Employee Add Failed", "Missing required fields.")
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO employee_master (employee_id, employee_name, designation, email_id, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employee_id, employee_name, designation, email_id, phone_number]
    );
     // Log successful employee addition
     await logEvent("Employee Added", `Employee ${employee_id} (${employee_name}) added successfully.`);
    res.status(200).json({ success: true, message: 'Employee added successfully', data: result.rows[0] });
  } catch (error) {
    // Log error if insertion fails
    await logEvent("Server Error", `Error adding employee ${employee_id}.`);
    res.status(500).json({ success: false, message: 'Error adding employee' });
  }
});

//trade_employee
app.post("/api/trade_employee", async (req, res) => {
  await logEvent("Trade Assignment Failed", "Missing employee_id or trade_id.");
  const { employee_id, trade_id } = req.body;

  try {
    await pool.query(
      "INSERT INTO trade_employee (employee_id, trade_id) VALUES ($1, $2)",
      [employee_id, trade_id]
    );
    // Log successful trade assignment
    await logEvent("Trade Assigned", `Employee ${employee_id} assigned to trade ${trade_id} successfully.`);

    res.json({ success: true, message: "Employee assigned to trade successfully" });
  } catch (error) {
    console.error("Error associating employee with trade:", error);
    // Log error if insertion fails
    await logEvent("Server Error", `Error assigning employee ${employee_id} to trade ${trade_id}.`);
    res.status(500).json({ error: "Server error linking employee to trade" });
  }
});


// Update employee (requires 'update' permission, ID: 3)
app.put('/api/employees/:employee_id', checkPermission([3]), async (req, res) => {
  const { employee_id } = req.params;
  const { employee_name, designation, email_id, phone_number } = req.body;
  if (!employee_name || !designation || !email_id || !phone_number) {
    await logEvent("Employee Update Failed", `Missing fields for Employee ID: ${employee_id}`);
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      `UPDATE employee_master 
       SET employee_name = $1, designation = $2, email_id = $3, phone_number = $4 
       WHERE employee_id = $5 
       RETURNING *;`, 
      [employee_name, designation, email_id, phone_number, employee_id]
    );
    if (result.rowCount > 0) {
      // Log successful employee update
      await logEvent("Employee Updated", `Employee ${employee_id} updated successfully.`);
      res.json({ success: true, message: 'Employee updated successfully', employee: result.rows[0] });
    } else {
      // Log update attempt where no changes were made
      await logEvent("Employee Update Failed", `No changes made for Employee ID: ${employee_id}`);
      res.json({ success: false, message: 'Employee not found or no changes made' });
    }
  } catch (error) {
     // Log error if update fails
     await logEvent("Server Error", `Error updating Employee ID: ${employee_id}`);
    res.status(500).json({ success: false, message: 'Error updating employee' });
  }
});


//update trade
app.put("/api/trade_employee", async (req, res) => {
  const { employee_id, trade_id } = req.body;

  try {
    await logEvent("Trade Update Failed", "Missing employee_id or trade_id.");
    // Check if employee already has a trade
    const existingTrade = await pool.query("SELECT * FROM trade_employee WHERE employee_id = $1", [employee_id]);

    if (existingTrade.rows.length > 0) {
      // Log successful trade update
      await logEvent("Trade Updated", `Employee ${employee_id} reassigned to trade ${trade_id}.`);
      // Update existing trade
      await pool.query("UPDATE trade_employee SET trade_id = $1 WHERE employee_id = $2", [trade_id, employee_id]);
    } else {
      // Log new trade assignment
      await logEvent("Trade Assigned", `Employee ${employee_id} assigned to trade ${trade_id}.`);
      // Insert new trade association
      await pool.query("INSERT INTO trade_employee (employee_id, trade_id) VALUES ($1, $2)", [employee_id, trade_id]);
    }

    res.json({ success: true, message: "Employee trade updated successfully" });
  } catch (error) {
    console.error("Error updating employee trade:", error);
     // Log error if update fails
     await logEvent("Server Error", `Error updating trade for Employee ID: ${employee_id}.`);
    res.status(500).json({ error: "Server error updating employee trade" });
  }
});


//DELETE
app.delete("/api/employees/:employee_id", checkPermission([4]), async (req, res) => {
  const { employee_id } = req.params;

  try {
    console.log(`Deleting related records for employee ID: ${employee_id}`);
    
    // First, delete dependent records from trade_employee
    await pool.query(
      "DELETE FROM trade_employee WHERE employee_id = $1",
      [employee_id]
    );

    console.log(`Deleting employee with ID: ${employee_id}`);
    
    // Now, delete employee from employee_master
    const result = await pool.query(
      "DELETE FROM employee_master WHERE employee_id = $1 RETURNING *",
      [employee_id]
    );

    if (result.rows.length > 0) {
      console.log(`Employee ID ${employee_id} deleted successfully`);
      res.status(200).json({ success: true, message: "Employee deleted" });
    } else {
      console.log(`Employee ID ${employee_id} not found`);
      res.status(404).json({ success: false, message: "Employee not found" });
    }
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});


// Fetch current user's permissions
app.get("/api/permissions/current_user", checkPermission([]), async (req, res) => {
  try {
    const { employeeId } = req.user;

    if (!employeeId) 
      {
        await logEvent("Permission Fetch Failed", "Employee ID missing in request.");
        return res.status(400).json({ success: false, message: "Employee ID is required" });
        
      }
    const roleQuery = `SELECT role_id FROM employee_master WHERE employee_id = $1`;
    const roleResult = await pool.query(roleQuery, [employeeId]);

    if (roleResult.rows.length === 0) {
      await logEvent("Permission Fetch Failed", `Invalid Employee ID: ${employeeId}`);
      return res.status(403).json({ success: false, message: "Access denied: Invalid employee ID" });
    }

    const roleId = roleResult.rows[0].role_id;
    const permissionQuery = `SELECT permission_name 
                             FROM permissions p
                             JOIN role_permissions rp ON p.permission_id = rp.permission_id
                             WHERE rp.role_id = $1`;
    const permissionResult = await pool.query(permissionQuery, [roleId]);

    const permissions = permissionResult.rows.map(row => row.permission_name);
    if (permissions.length === 0) {
      await logEvent("Permission Fetch Warning", `No permissions assigned to Employee ID: ${employeeId}`);
      return res.status(403).json({ success: false, message: "No permissions assigned to this role" });
    }
    await logEvent("Permissions Retrieved", `Permissions fetched for Employee ID: ${employeeId}`);
    res.status(200).json({ success: true, permissions });
  } catch (error) {
    await logEvent("Server Error", `Error fetching permissions for Employee ID: ${employeeId}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Fetch roles
app.get("/api/roles", async (_req, res) => {
  try {
    const result = await pool.query("SELECT role_id, role_name FROM role_master");

    await logEvent("Roles Retrieved", `Fetched ${result.rows.length} roles from role_master.`);
    res.status(200).json({
      success: true,
      roles: result.rows, // Sending all roles with role_id and role_name
    });
  } catch (error) {
    console.error("Error fetching roles:", error.message);
    await logEvent("Server Error", "Error fetching roles from role_master.");
    res.status(500).json({ success: false, message: "Error fetching roles" });
  }
});

// Fetch all menus
app.get("/api/menus", async (_req, res) => {
  try {
    const query = `
      SELECT menu_id, menu_name
      FROM menu_master
    `;
    const result = await pool.query(query);
    await logEvent("Menus Retrieved", `Fetched ${result.rows.length} menus from menu_master.`);
    res.status(200).json({
      success: true,
      menus: result.rows, // Send all menus from the menu_master table
    });
  } catch (error) {
    console.error("Error fetching menus:", error.message);
    await logEvent("Server Error", "Error fetching menus from menu_master.");
    res.status(500).json({ success: false, message: "Error fetching menus" });
  }
});

// Assign menus to a role
app.post("/api/assign-menus", async (req, res) => {
  const { role_id, menu_ids } = req.body;

  try {
    // Input validation
    if (!role_id || !menu_ids || !Array.isArray(menu_ids) || menu_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid data: role_id or menu_ids missing/invalid" });
    }

    // Start a transaction
    await pool.query("BEGIN");

    // Delete existing role-menu assignments for the role
    const deleteQuery = "DELETE FROM role_menu WHERE role_id = $1";
    await pool.query(deleteQuery, [role_id]);

    // Prepare query for inserting new role-menu assignments
    const insertQuery = `
      INSERT INTO role_menu (role_id, menu_id)
      VALUES ${menu_ids.map((_, index) => `($1, $${index + 2})`).join(", ")}
    `;

    // Execute the insertion
    await pool.query(insertQuery, [role_id, ...menu_ids]);

    // Commit the transaction
    await pool.query("COMMIT");

    // Log successful assignment
    await logEvent("Role Menu Assignment", `Assigned ${menu_ids.length} menus to role ID ${role_id}`);

    res.status(200).json({ success: true, message: "Menus assigned successfully" });
  } catch (error) {
    // Rollback the transaction on any error
    await pool.query("ROLLBACK");

    console.error("Error in /api/assign-menus:", error.message);

    await logEvent("Role Menu Assignment Failed", `Error assigning menus to role ID ${role_id}: ${error.message}`);
    // Respond with a generic error message
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
app.post("/api/work-order", upload.single("document"), async (req, res) => {
  try {
    const {
      controlNumber,
      workOrderNumber,
      projectCode,
      priority,
      groupWorkOrder,
      workOrderDate,
      receivedDate,
      desiredCompletionDate,
      productDescription,
    } = req.body;

    // Validate required fields
    if (
      !controlNumber ||
      !workOrderNumber ||
      !projectCode ||
      !priority ||
      !groupWorkOrder ||
      !workOrderDate ||
      !receivedDate ||
      !desiredCompletionDate ||
      !productDescription
    ) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate controlNumber is numeric
    if (!/^\d+$/.test(controlNumber)) {
      return res.status(400).json({ success: false, message: "Control Number must be numeric" });
    }

    // Handle file upload
    const documentPath = req.file ? `uploads/${req.file.filename}` : null;

    // Insert into DB
    const result = await pool.query(
      `INSERT INTO work_order_master (
        control_number, work_order_number, project_code, priority, 
        group_section, work_order_date, received_date, desired_completion_date, 
        product_description, doc_upload_path, created_date, created_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, 1)
      RETURNING control_number`,
      [
        controlNumber,
        workOrderNumber,
        projectCode,
        priority,
        groupWorkOrder,
        workOrderDate,
        receivedDate,
        desiredCompletionDate,
        productDescription,
        documentPath,
      ]
    );

    const insertedControlNumber = result.rows[0].control_number;

    // Log creation
    await logEvent(
      "Work Order Created",
      `Work order ${workOrderNumber} (Control #${insertedControlNumber}) created successfully.`
    );

    res.json({ success: true, controlNumber: insertedControlNumber, documentPath });
  } catch (err) {
    console.error("Error saving work order:", err);
    await logEvent("Work Order Creation Failed", `Error saving work order: ${err.message}`);
    res.status(500).json({ success: false, message: "Error saving work order" });
  }
});

app.post("/api/part", async (req, res) => {
  const client = await pool.connect();
  try {
    const { controlNumber, parts } = req.body;

    // Validate request
    if (!controlNumber || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid part data" });
    }

    // Validate controlNumber is numeric
    if (!/^\d+$/.test(controlNumber)) {
      return res.status(400).json({ success: false, message: "Control Number must be numeric" });
    }

    // Validate controlNumber exists in work_order_master
    const controlNumberCheck = await client.query(
      "SELECT 1 FROM work_order_master WHERE control_number = $1",
      [controlNumber]
    );
    if (controlNumberCheck.rowCount === 0) {
      return res.status(400).json({ success: false, message: "Invalid Control Number" });
    }

    // Begin transaction
    await client.query("BEGIN");

    for (const part of parts) {
      if (!part.partNumber || !part.description || !part.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Missing part fields" });
      }
      await client.query(
        `INSERT INTO part_master (control_number, part_number, description, quantity, created_date, created_id) 
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1)`,
        [controlNumber, part.partNumber, part.description, part.quantity]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    // Log successful part addition
    await logEvent("Parts Added", `Parts added for Control #${controlNumber}`);
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    await logEvent("Part Addition Failed", `Error adding parts for Control #${controlNumber}: ${err.message}`);
    res.status(500).json({ success: false, message: "Error saving parts" });
  } finally {
    client.release();
  }
});

app.get("/api/control-numberss", async (_req, res) => {
  try {
     const result = await pool.query("SELECT control_number FROM work_order_master");
    await logEvent("Control Numbers Fetched", "No control numbers found.");
    res.json(result.rows.map(row => row.control_number));
   } catch (error) {
     await logEvent("Control Number Fetch Failed", error.message);
    console.error("Error fetching control numbers:", error);
    res.status(500).json({ error: "Internal Server Error" });
 }
 });

//assign task
app.get("/parts/:controlNumber", async (req, res) => {
  try {
    const { controlNumber } = req.params;
    const query = `
      SELECT part_number FROM part_master WHERE control_number = $1
    `;
    const result = await pool.query(query, [controlNumber]);

    if (result.rows.length > 0) {

       // Log success event
    await logEvent("Parts Fetch", `Fetched ${result.rows.length} parts for control number: ${controlNumber}`);

      res.json(result.rows.map(row => row.part_number));
    } else {
      await logEvent("Parts Fetch", `No parts found for control number: ${controlNumber}`);
      res.status(404).json({ message: "No parts found" });
    }
  } catch (error) {
    console.error("Database error:", error);
    await logEvent("Parts Fetch Failed", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Fetch trade names
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT trade_id, trade_name FROM trade_master");
  // Log success event
  await logEvent("Trade Fetch", `Fetched ${result.rows.length} trades`);
    res.json(result.rows);
  } catch (err) {
    await logEvent("Trade Fetch", "No trades found in trade_master table");
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

app.get("/api/employees/:trade_id", async (req, res) => {
  try {
    const { trade_id } = req.params;
// Log the request event
await logEvent("FETCH_EMPLOYEES", `Fetching employees for trade ID: ${trade_id}`);
    const result = await pool.query(
      `SELECT e.employee_id, e.employee_name 
       FROM trade_employee te 
       JOIN employee_master e ON te.employee_id = e.employee_id 
       WHERE te.trade_id = $1`, 
      [trade_id]
    );

    if (result.rows.length === 0) {
      await logEvent("FETCH_EMPLOYEES", `No employees found for trade ID: ${trade_id}`);
      return res.status(404).json({ message: "No employees found for this trade." });
    }
 // Log success event
 await logEvent("FETCH_EMPLOYEES", `Successfully fetched ${result.rows.length} employees for trade ID: ${trade_id}`);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching employees:", err.message);
      // Log error event
      await logEvent("ERROR", `Error fetching employees for trade ID: ${trade_id} - ${err.message}`);
    res.status(500).send("Server Error");
  }
});

app.post("/api/assign_tasks", upload.single("document"), async (req, res) => {
  try {
    console.log("✅ Received request to assign tasks", { body: req.body, file: req.file });

    // Validate file upload
    if (!req.file) {
      await logEvent("ASSIGN_TASK_ERROR", "No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Parse tasks
    let tasks;
    try {
      tasks = JSON.parse(req.body.tasks || "[]");
      console.log("Parsed tasks:", JSON.stringify(tasks, null, 2));
    } catch (jsonError) {
      console.error("❌ JSON parse error:", jsonError.message);
      await logEvent("ASSIGN_TASK_ERROR", `Invalid tasks format: ${jsonError.message}`);
      return res.status(400).json({ message: "Invalid tasks format" });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      await logEvent("ASSIGN_TASK_ERROR", "No tasks provided");
      return res.status(400).json({ message: "No tasks provided" });
    }

    const docUploadPath = `/uploads/${req.file.filename}`;
    await logEvent("ASSIGN_TASK", `File uploaded: ${docUploadPath}`);

    const assignedBy = req.body.assigned_by;
    if (!assignedBy) {
      await logEvent("ASSIGN_TASK_ERROR", "Assigned by is required");
      return res.status(400).json({ message: "Assigned by is required" });
    }

    const assignments = [];

    for (let task of tasks) {
      const { controlNumber, parts, employees, startDate, endDate, qcRequired, qcEmployees } = task;
      console.log(`Processing task: ${controlNumber}`, { qcRequired, qcEmployees });

      // Validate regular employee assignments
      const employeeIdsInput = employees.map((e) => e.employee_id?.trim()).filter(Boolean);
      const employeeNamesInput = employees
        .filter((e) => !e.employee_id && e.employee_name)
        .map((e) => e.employee_name.trim());

      let employeeIds = [];

      if (employeeIdsInput.length > 0) {
        const result = await pool.query(
          `SELECT employee_id FROM employee_master WHERE UPPER(employee_id) = ANY($1)`,
          [employeeIdsInput.map((id) => id.toUpperCase())]
        );
        employeeIds = result.rows.map((r) => r.employee_id);
        const missing = employeeIdsInput.filter(
          (id) => !employeeIds.some((validId) => validId.toUpperCase() === id.toUpperCase())
        );
        if (missing.length > 0) {
          console.error(`Invalid employee IDs: ${missing.join(", ")}`);
          await logEvent("ASSIGN_TASK_ERROR", `Invalid employee IDs: ${missing.join(", ")}`);
          return res.status(400).json({ message: `Invalid employee IDs: ${missing.join(", ")}` });
        }
      }

      if (employeeNamesInput.length > 0) {
        const result = await pool.query(
          `SELECT employee_id, employee_name FROM employee_master WHERE UPPER(TRIM(employee_name)) = ANY($1)`,
          [employeeNamesInput.map((name) => name.toUpperCase())]
        );
        const idsFromNames = result.rows.map((r) => r.employee_id);
        employeeIds = [...new Set([...employeeIds, ...idsFromNames])];
        const missingNames = employeeNamesInput.filter(
          (name) => !result.rows.some((r) => r.employee_name.toUpperCase() === name.toUpperCase())
        );
        if (missingNames.length > 0) {
          console.error(`No valid employees for names: ${missingNames.join(", ")}`);
          await logEvent("ASSIGN_TASK_ERROR", `No valid employees for names: ${missingNames.join(", ")}`);
          return res.status(400).json({ message: `No valid employees for names: ${missingNames.join(", ")}` });
        }
      }

      if (employeeIds.length === 0) {
        console.error(`No valid employees for control number ${controlNumber}`);
        await logEvent("ASSIGN_TASK_ERROR", `No valid employees for control number ${controlNumber}`);
        return res.status(400).json({ message: `No valid employees for control number ${controlNumber}` });
      }

      // Generate assignment ID
      const assignmentIdRes = await pool.query(`SELECT nextval('assignment_id_seq') AS assignment_id`);
      const assignmentId = assignmentIdRes.rows[0].assignment_id;
      console.log(`Generated assignment ID: ${assignmentId}`);

      // Insert task assignments
      for (let empId of employeeIds) {
        await pool.query(
          `INSERT INTO assign_task (assignment_id, control_number, part_number, employee_id, start_date, end_date, doc_upload_path, assigned_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [assignmentId, controlNumber, parts, empId, startDate, endDate, docUploadPath, assignedBy]
        );

        // Send FCM notification for regular employees
        try {
          const tokenResult = await pool.query(
            `SELECT fcm_token FROM employee_master WHERE employee_id = $1`,
            [empId]
          );
          const token = tokenResult.rows[0]?.fcm_token;
          if (token) {
            const message = {
              notification: {
                title: "🛠 New Task Assigned",
                body: `Task ${controlNumber} has been assigned to you.`,
              },
              token,
            };
            const fcmResponse = await admin.messaging().send(message);
            console.log(`📲 FCM sent to employee ${empId}:`, fcmResponse);
          } else {
            console.warn(`⚠️ No FCM token for employee ${empId}`);
            await logEvent("ASSIGN_TASK_WARNING", `No FCM token for employee ${empId}`);
          }
        } catch (err) {
          console.error(`❌ FCM error for employee ${empId}:`, err.message);
          await logEvent("ASSIGN_TASK_ERROR", `FCM error for employee ${empId}: ${err.message}`);
        }
      }

      // Handle QC assignments if qcRequired is "yes" (without storing in qc_details)
      let validQcEmployees = [];
      if (qcRequired === "yes" && qcEmployees && qcEmployees.length > 0) {
        console.log(`Processing QC employees for task ${controlNumber}:`, JSON.stringify(qcEmployees, null, 2));

        // Fetch all QC employee IDs from qc_master for comparison
        const allQcEmployees = await pool.query(`SELECT employee_id FROM qc_master`);
        const validQcIds = allQcEmployees.rows.map((row) => row.employee_id);
        console.log(`All QC employee IDs in qc_master:`, validQcIds);

        const qcEmployeeIds = qcEmployees.map((e) => e.employee_id?.trim()).filter(Boolean);
        console.log(`Received QC employee IDs:`, qcEmployeeIds);

        if (qcEmployeeIds.length > 0) {
          // Validate QC employees with case-insensitive matching
          const qcResult = await pool.query(
            `SELECT employee_id, employee_name, fcm_token FROM qc_master WHERE UPPER(employee_id) = ANY($1)`,
            [qcEmployeeIds.map((id) => id.toUpperCase())]
          );
          validQcEmployees = qcResult.rows;
          console.log(`Valid QC employees from qc_master:`, JSON.stringify(validQcEmployees, null, 2));

          // Map input IDs to valid IDs (preserving original case from qc_master)
          const inputToValidIdMap = new Map();
          validQcEmployees.forEach((emp) => {
            const inputId = qcEmployeeIds.find((id) => id.toUpperCase() === emp.employee_id.toUpperCase());
            if (inputId) inputToValidIdMap.set(inputId, emp.employee_id);
          });

          const missingQc = qcEmployeeIds.filter(
            (id) => !validQcEmployees.some((e) => e.employee_id.toUpperCase() === id.toUpperCase())
          );
          if (missingQc.length > 0) {
            console.error(`Invalid QC employee IDs: ${missingQc.join(", ")}`);
            await logEvent("ASSIGN_TASK_ERROR", `Invalid QC employee IDs: ${missingQc.join(", ")}`);
            return res.status(400).json({ message: `Invalid QC employee IDs: ${missingQc.join(", ")}` });
          }

          // Send FCM notifications for QC employees
          for (let qcEmp of validQcEmployees) {
            try {
              const token = qcEmp.fcm_token;
              if (token) {
                const message = {
                  notification: {
                    title: "🔍 New QC Task Assigned",
                    body: `You have been assigned quality checking for task ${controlNumber}.`,
                  },
                  token,
                };
                const fcmResponse = await admin.messaging().send(message);
                console.log(`📲 QC FCM sent to ${qcEmp.employee_id}:`, fcmResponse);
              } else {
                console.warn(`⚠️ No FCM token for QC employee ${qcEmp.employee_id}`);
                await logEvent("ASSIGN_TASK_WARNING", `No FCM token for QC employee ${qcEmp.employee_id}`);
              }
            } catch (err) {
              console.error(`❌ QC FCM error for ${qcEmp.employee_id}:`, err.message);
              await logEvent("ASSIGN_TASK_ERROR", `QC FCM error for ${qcEmp.employee_id}: ${err.message}`);
            }
          }
        } else {
          console.warn(`⚠️ No valid QC employee IDs provided for task ${controlNumber}`);
          await logEvent("ASSIGN_TASK_WARNING", `No valid QC employee IDs for task ${controlNumber}`);
        }
      } else {
        console.log(`No QC required for task ${controlNumber}`);
      }

      assignments.push({
        controlNumber,
        employees: employeeIds.map((id) => ({
          employee_id: id,
          employee_name: employees.find((e) => e.employee_id.toUpperCase() === id.toUpperCase())?.employee_name || "Unknown",
        })),
        qcEmployees:
          qcRequired === "yes"
            ? validQcEmployees.map((e) => ({
                employee_id: e.employee_id,
                employee_name: e.employee_name || "Unknown",
              }))
            : [],
      });
    }

    console.log("🎉 All tasks assigned and notifications sent!", { assignments });
    res.status(201).json({
      message: "Tasks assigned successfully!",
      assignments,
    });

  } catch (err) {
    console.error("❌ Error assigning tasks:", err.message, err.stack);
    await logEvent("ASSIGN_TASK_ERROR", `Error assigning tasks: ${err.message}`);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});
app.get("/api/assigned-menus/:roleId", async (req, res) => {
  const { roleId } = req.params;
  try {
      const assignedMenus = await db.query(
          "SELECT menu_id FROM role_menu WHERE role_id = $1",
          [roleId]
      );

      console.log("Fetched Menus:", assignedMenus.rows);

      res.json({
          success: true,
          menu_ids: assignedMenus.rows.map((row) => row.menu_id),
      });
  } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ success: false, message: "Error fetching menus" });
  }
});
//futter apis
// Get employee details by ID
app.get("/api/employee/details/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT employee_name, employee_id, email_id, designation FROM employee_master WHERE employee_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Log successful employee retrieval
    await logEvent("Fetch Employee", `User retrieved details for employee ID: ${id}`);

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching employee details:", err);
    await logEvent("Server Error", `Error retrieving employee ID: ${id}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/assigned-jobs/:empId", async (req, res) => {
  try {
    const empId = req.params.empId;
    const query = `
      SELECT * FROM assign_task
      WHERE employee_id = $1;  
    `;

    const { rows } = await pool.query(query, [empId]);

    if (rows.length > 0) {
      res.json({ success: true, job: rows });
    } else {
      res.json({ success: false, job: [] });
    }
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// GET /api/job-details/:controlNumber/:id
app.get('/api/job-details/:controlNumber/:id', async (req, res) => {
  const controlNumber = parseInt(req.params.controlNumber, 10);
  const id = parseInt(req.params.id, 10);

  console.log('📌 Received Control Number:', controlNumber);
  console.log('📌 Received Job ID:', id);

  if (isNaN(controlNumber) || isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid parameters: controlNumber and id must be numbers' });
  }

  try {
    const assignmentResult = await pool.query(
      `SELECT assignment_id FROM assign_task WHERE id = $1 AND control_number = $2`,
      [id, controlNumber]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found for the given id and control number' });
    }

    const assignmentId = assignmentResult.rows[0].assignment_id;

    const jobQuery = `
      WITH all_employees AS (
        SELECT TRIM(emp_id) AS emp_id
        FROM (
          SELECT unnest(string_to_array(employee_id, ',')) AS emp_id
          FROM assign_task
          WHERE assignment_id = $1 AND control_number = $2
        ) AS employee_ids
      ),
      employee_names AS (
        SELECT 
          STRING_AGG(DISTINCT COALESCE(em.employee_name, gm.group_name, ae.emp_id), ', ') AS names
        FROM all_employees ae
        LEFT JOIN employee_master em ON em.employee_id::TEXT = ae.emp_id
        LEFT JOIN group_master gm ON gm.group_name = ae.emp_id
      ),
      employee_task_details AS (
        SELECT 
          a.id,
          a.employee_id,
          a.status AS individual_status,
          COALESCE(em.employee_name, gm.group_name, a.employee_id) AS employee_name,
          tm.trade_name,
          a.start_date,
          a.end_date,
          a.actual_start_date,
          a.actual_end_date,
          COALESCE(
            a.total_working_days,
            CASE
              WHEN a.actual_start_date IS NOT NULL AND a.actual_end_date IS NOT NULL THEN
                GREATEST(1, DATE_PART('day', a.actual_end_date - a.actual_start_date)::int)
              ELSE NULL
            END
          ) AS total_working_days
        FROM assign_task a
        LEFT JOIN employee_master em ON em.employee_id::TEXT = a.employee_id
        LEFT JOIN group_master gm ON gm.group_name = a.employee_id
        LEFT JOIN trade_employee te ON te.employee_id = a.employee_id
        LEFT JOIN trade_master tm ON tm.trade_id = te.trade_id
        WHERE a.assignment_id = $1 AND a.control_number = $2
      )
      SELECT 
        a.id, 
        a.control_number, 
        LOWER(TRIM(COALESCE(MAX(a.status), 'not started'))) AS status,
        a.part_number,  
        a.start_date, 
        a.end_date,
        a.actual_start_date,
        a.actual_end_date,
        COALESCE(
          a.total_working_days,
          CASE
            WHEN a.actual_start_date IS NOT NULL AND a.actual_end_date IS NOT NULL THEN
              GREATEST(1, DATE_PART('day', a.actual_end_date - a.actual_start_date)::int)
            ELSE NULL
          END
        ) AS total_working_days,
        a.doc_upload_path,
        a.material_detail,
        en.names AS employee_names,
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'part_number', pm.part_number,
            'quantity', pm.quantity,
            'description', pm.description
          )
        ) FILTER (WHERE pm.part_number IS NOT NULL) AS part_details,
        w.group_section,
        w.priority,
        w.work_order_number,
        w.project_code,
        w.product_description,
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'employee_id', etd.employee_id,
            'employee_name', etd.employee_name,
            'trade_name', etd.trade_name,
            'individual_status', etd.individual_status,
            'start_date', etd.start_date,
            'end_date', etd.end_date,
            'actual_start_date', etd.actual_start_date,
            'actual_end_date', etd.actual_end_date,
            'total_working_days', etd.total_working_days
          )
        ) FILTER (WHERE etd.employee_id IS NOT NULL) AS employee_task_details
      FROM assign_task a
      JOIN work_order_master w ON a.control_number = w.control_number
      LEFT JOIN part_master pm ON pm.part_number = ANY(a.part_number)
      CROSS JOIN employee_names en
      JOIN employee_task_details etd ON TRUE
      WHERE a.assignment_id = $1 AND a.control_number = $2
      GROUP BY 
        a.id, a.control_number, a.part_number, a.start_date, a.end_date, 
        a.actual_start_date, a.actual_end_date, a.total_working_days, 
        a.doc_upload_path, a.material_detail,
        en.names, w.group_section, w.priority,
        w.work_order_number, w.project_code, w.product_description
      ORDER BY a.id
      LIMIT 1;
    `;

    const { rows } = await pool.query(jobQuery, [assignmentId, controlNumber]);

    if (rows.length > 0) {
      const job = rows[0];
      console.log('📋 Job Details:', JSON.stringify(job, null, 2));
      return res.json({ success: true, job_details: job });
    } else {
      return res.status(404).json({ success: false, message: 'Job details not found' });
    }
  } catch (error) {
    console.error('❌ Error fetching job details:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

//not and  id parameter
app.get("/api/job-details/:controlNumber", async (req, res) => {
  const controlNumber = parseInt(req.params.controlNumber, 10);
  console.log("📌 Received Control Number:", controlNumber);

  if (isNaN(controlNumber)) {
    return res.status(400).json({ success: false, message: "Invalid control number" });
  }

  try {
    const jobQuery = `
      WITH all_tasks AS (
        SELECT 
          a.id,
          a.assignment_id,
          a.control_number,
          a.status,
          a.part_number,
          a.start_date,
          a.end_date,
          a.actual_start_date,
          a.actual_end_date,
          COALESCE(
            a.total_working_days,
            CASE
              WHEN a.actual_start_date IS NOT NULL AND a.actual_end_date IS NOT NULL THEN
                GREATEST(1, DATE_PART('day', a.actual_end_date - a.actual_start_date)::int)
              ELSE NULL
            END
          ) AS total_working_days,
          a.doc_upload_path,
          a.material_detail,
          a.employee_id
        FROM assign_task a
        WHERE a.control_number = $1
      ),
      employee_names AS (
        SELECT 
          a.id AS task_id,
          STRING_AGG(DISTINCT COALESCE(em.employee_name, gm.group_name, emp.emp_id), ', ') AS employee_names
        FROM all_tasks a
        CROSS JOIN LATERAL unnest(string_to_array(a.employee_id, ',')) AS emp(emp_id)
        LEFT JOIN employee_master em ON em.employee_id::TEXT = emp.emp_id
        LEFT JOIN group_master gm ON gm.group_name = emp.emp_id
        GROUP BY a.id
      ),
      task_details AS (
        SELECT 
          a.*,
          COALESCE(em.employee_name, gm.group_name, a.employee_id) AS employee_name,
          tm.trade_name
        FROM all_tasks a
        LEFT JOIN employee_master em ON em.employee_id::TEXT = a.employee_id
        LEFT JOIN group_master gm ON gm.group_name = a.employee_id
        LEFT JOIN trade_employee te ON te.employee_id = a.employee_id
        LEFT JOIN trade_master tm ON tm.trade_id = te.trade_id
      )
      SELECT 
        td.id,
        td.control_number,
        td.status,
        td.start_date,
        td.end_date,
        td.actual_start_date,
        td.actual_end_date,
        td.total_working_days,
        td.doc_upload_path,
        td.material_detail,
        en.employee_names,
        td.employee_name,
        td.trade_name,
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'part_number', pm.part_number,
            'quantity', pm.quantity,
            'description', pm.description
          )
        ) AS part_details,
        wom.group_section,
        wom.priority,
        wom.work_order_number,
        wom.project_code,
        wom.product_description
      FROM task_details td
      JOIN employee_names en ON td.id = en.task_id
      JOIN work_order_master wom ON td.control_number = wom.control_number
      LEFT JOIN part_master pm ON pm.part_number = ANY(td.part_number)
      GROUP BY 
        td.id, td.control_number, td.status, td.start_date, td.end_date, td.actual_start_date, 
        td.actual_end_date, td.total_working_days, td.doc_upload_path, td.material_detail, 
        td.employee_name, td.trade_name, en.employee_names, wom.group_section, wom.priority, 
        wom.work_order_number, wom.project_code, wom.product_description
      ORDER BY td.id;
    `;

    const { rows } = await pool.query(jobQuery, [controlNumber]);

    if (rows.length > 0) {
      return res.json({ success: true, job_details: rows });
    } else {
      return res.status(404).json({ success: false, message: "Job details not found" });
    }
  } catch (error) {
    console.error("❌ Error fetching job details:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

//both flutter and web 
app.get("/api/notifications/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log("🟢 API Received Employee ID:", employeeId);

    const query = `SELECT id, message, is_read, created_at FROM notifications 
                   WHERE employee_id = $1 ORDER BY created_at DESC`;
    console.log("🟡 Executing Query:", query, "With Parameter:", employeeId);

    const result = await pool.query(query, [employeeId]);

    console.log("📋 Query Result:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//flutter
app.post("/api/notifications/read/:empId", async (req, res) => {
  const { empId } = req.params;
  try {
      await pool.query("UPDATE notifications SET is_read = TRUE WHERE employee_id = $1", [empId]);
      res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
      console.error("❌ Error updating notifications:", error);
      res.status(500).json({ success: false, message: "Server error" });
  }
});

// Leave Requests API
app.get("/api/leaverequests", async (_req, res) => {
  try {
    const leaveRequests = await pool.query("SELECT * FROM leave_request");
    res.json(leaveRequests.rows);
  } catch (error) {
    console.error("❌ Error fetching leave requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/api/leaverequests", async (req, res) => {
  const {
    emp_id,
    emp_name,
    leave_type,
    start_date,
    end_date,
    reason,
    half_day_period    // ← grab it here
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO leave_request
        (emp_id, emp_name, leave_type, start_date, end_date, reason, status, half_day_period)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7)`,
      [emp_id, emp_name, leave_type, start_date, end_date, reason, half_day_period]
    );

    res.status(201).json({ message: "Leave request added" });
  } catch (error) {
    console.error("❌ Error adding leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//web
app.put("/api/leaverequests/:id", async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    await pool.query("UPDATE leave_request SET status = $1 WHERE id = $2", [status, id]);
    res.json({ message: "Leave request updated" });
  } catch (error) {
    console.error("❌ Error updating leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/api/leave_master", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, leave_type FROM leave_master");
    res.json(result.rows); // ✅ Returns an array of leave types
  } catch (error) {
    console.error("❌ Error fetching leave types:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

//web
app.post("/api/leaverequests", async (req, res) => {
  const { emp_id, leave_type, half_day, start_date, end_date, reason } = req.body;

  try {
    await pool.query(
      "INSERT INTO leave_requests (emp_id, leave_type, half_day, start_date, end_date, reason) VALUES ($1, $2, $3, $4, $5, $6)",
      [emp_id, leave_type, leave_type === "Casual Leave" ? half_day : null, start_date, end_date, reason]
    );

    res.status(201).json({ success: true, message: "Leave request submitted successfully" });
  } catch (error) {
    console.error("❌ Error inserting leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

//web
app.get("/api/employee_master/:employee_id", async (req, res) => {
  const { employee_id } = req.params; // ✅ Use employee_id
  try {
    const result = await pool.query(
      "SELECT employee_name FROM employee_master WHERE employee_id = $1",
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ employee_name: result.rows[0].employee_name }); // ✅ Ensure correct field name
  } catch (error) {
    console.error("❌ Error fetching employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// DELETE Leave Request API
app.delete("/api/leaverequests/:id", async (req, res) => {
  const { id } = req.params;

  try {
      // Check if the leave request exists
      const leaveRequest = await pool.query("SELECT * FROM leave_request WHERE id = $1", [id]);
      
      if (leaveRequest.rows.length === 0) {
          return res.status(404).json({ message: "Leave request not found" });
      }

      // Delete the leave request
      await pool.query("DELETE FROM leave_request WHERE id = $1", [id]);

      res.status(200).json({ message: "Leave request deleted successfully" });
  } catch (error) {
      console.error("Error deleting leave request:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

//total working day   calculation
app.post("/update-job-status", async (req, res) => {
  console.log("📥 Incoming Request:", req.body);

  const { id: rawId, status, reason } = req.body;
  if (!rawId || !status) {
    return res.status(400).json({ success: false, message: "⚠️ Missing id or status" });
  }

  const id = parseInt(rawId, 10);

  try {
    // 🔎 1. Fetch current task
    const { rows } = await pool.query(
      `SELECT status, actual_end_date, employee_id, start_date, actual_start_date, end_date
       FROM assign_task
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "❌ Job not found" });
    }

    const task = rows[0];
    const currentStatus = (task.status || "").toLowerCase();
    const employeeId   = parseInt(task.employee_id, 10);
    const newStatus    = status.toLowerCase();

    // 🔀 2. Handle status transition
    switch (newStatus) {
      case "on hold": {
        if (!["ongoing", "pending"].includes(currentStatus)) {
          return res.status(400).json({
            success: false,
            message: `⛔ Only ONGOING or PENDING tasks can be put on hold. Current: ${currentStatus}`
          });
        }
        if (!reason) {
          return res.status(400).json({ success: false, message: "⚠️ Hold reason is required" });
        }

        await pool.query("BEGIN");
        await pool.query(
          `UPDATE assign_task
           SET status = 'on hold',
               actual_end_date = NULL
           WHERE id = $1`,
          [id]
        );
        const holdResult = await pool.query(
          `INSERT INTO task_hold_history (assign_task_id, hold_start_date, hold_reason)
           VALUES ($1, CURRENT_TIMESTAMP, $2)
           RETURNING hold_start_date`,
          [id, reason]
        );
        await pool.query("COMMIT");

        return res.json({
          success: true,
          message: "✅ Task put ON HOLD",
          status: "on hold",
          hold_start_date: holdResult.rows[0].hold_start_date
        });
      }

      case "completed": {
        if (currentStatus !== "ongoing") {
          return res.status(400).json({
            success: false,
            message: `⛔ Only ONGOING tasks can be completed. Current: ${currentStatus}`
          });
        }

        // 📊 Calculate working days
        const workingDaysQuery = `
          WITH task_period AS (
            SELECT
              GREATEST(start_date, COALESCE(actual_start_date::date, start_date)) AS period_start,
              CASE WHEN status = 'completed'
                   THEN actual_end_date::date
                   ELSE LEAST(end_date, CURRENT_DATE)
              END AS period_end
            FROM assign_task
            WHERE id = $1
              AND employee_id::int = $2
          ),
          all_days AS (
            SELECT generate_series(period_start, period_end, '1 day')::date AS day
            FROM task_period
          ),
          weekdays AS (
            SELECT day
            FROM all_days
            WHERE EXTRACT(ISODOW FROM day) < 6
          ),
          leave_days AS (
            SELECT
              generate_series(start_date::date, end_date::date, '1 day')::date AS day,
              half_day_period
            FROM leave_request
            WHERE emp_id::int = $2
              AND status = 'Approved'
              AND start_date <= (SELECT period_end FROM task_period)
              AND end_date   >= (SELECT period_start FROM task_period)
          ),
          hold_periods AS (
            SELECT
              hold_start_date::date AS hold_start,
              COALESCE(hold_end_date::date, (SELECT period_end FROM task_period)) AS hold_end
            FROM task_hold_history
            WHERE assign_task_id = $1
              AND hold_start_date <= (SELECT period_end FROM task_period)
              AND (hold_end_date >= (SELECT period_start FROM task_period) OR hold_end_date IS NULL)
          ),
          without_holds AS (
            SELECT w.day
            FROM weekdays w
            WHERE NOT EXISTS (
              SELECT 1
              FROM hold_periods h
              WHERE w.day BETWEEN h.hold_start AND h.hold_end
            )
          ),
          combined AS (
            SELECT
              w.day,
              CASE
                WHEN ld.half_day_period IS NULL AND ld.day IS NOT NULL THEN 'FULL'
                WHEN ld.half_day_period IS NOT NULL THEN ld.half_day_period
                ELSE 'NONE'
              END AS leave_type
            FROM without_holds w
            LEFT JOIN leave_days ld ON w.day = ld.day
          ),
          summary AS (
            SELECT
              COUNT(*) FILTER (WHERE leave_type = 'FULL') * 0.0 AS full_day_leave,
              COUNT(*) FILTER (WHERE leave_type IN ('AM','PM')) * 0.5 AS half_day,
              COUNT(*) FILTER (WHERE leave_type = 'NONE') * 1.0 AS full_work_day
            FROM combined
          )
          SELECT (full_day_leave + half_day + full_work_day) AS working_days
          FROM summary;
        `;

        await pool.query("BEGIN");
        const wdRes = await pool.query(workingDaysQuery, [id, employeeId]);
        const totalWorkingDays = wdRes.rows[0]?.working_days ?? 0;

        const completeResult = await pool.query(
          `UPDATE assign_task
           SET status = 'completed',
               reason = $1,
               actual_end_date = CURRENT_TIMESTAMP,
               total_working_days = $2
           WHERE id = $3
           RETURNING status, actual_end_date, total_working_days`,
          [reason || "Task completed successfully", totalWorkingDays, id]
        );

        await pool.query("COMMIT");

        return res.json({
          success: true,
          message: "✅ Task marked COMPLETED",
          ...completeResult.rows[0]
        });
      }

      case "ongoing": {
        if (currentStatus === "ongoing") {
          return res.status(400).json({ success: false, message: "⚠️ Task is already ongoing!" });
        }

        await pool.query("BEGIN");
        await pool.query(
          `UPDATE assign_task
           SET status = 'ongoing',
               reason = NULL,
               actual_start_date = COALESCE(actual_start_date, CURRENT_TIMESTAMP)
           WHERE id = $1`,
          [id]
        );

        if (currentStatus === "on hold") {
          await pool.query(
            `UPDATE task_hold_history
             SET hold_end_date = CURRENT_TIMESTAMP
             WHERE id = (
               SELECT id
               FROM task_hold_history
               WHERE assign_task_id = $1
                 AND hold_end_date IS NULL
               ORDER BY hold_start_date DESC
               LIMIT 1
             )`,
            [id]
          );
        }

        await pool.query("COMMIT");

        return res.json({ success: true, message: "✅ Task set to ONGOING", status: "ongoing" });
      }

      default:
        return res.status(400).json({ success: false, message: "⚠️ Invalid status" });
    }
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ Error updating job status:", error);
    return res.status(500).json({ success: false, message: "🚨 Internal Server Error" });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { employee_id, new_password, confirm_password } = req.body;

  try {
    console.log("🔐 Forgot Password Request:", { employee_id, new_password, confirm_password });

    // Validate required fields
    if (!employee_id || !new_password || !confirm_password) {
      await logEvent("Forgot Password", `Missing fields for employee ID: ${employee_id}`);
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if passwords match
    if (new_password !== confirm_password) {
      await logEvent("Forgot Password", `Password mismatch for employee ID: ${employee_id}`);
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if employee exists
    const userQuery = "SELECT * FROM employee_master WHERE employee_id = $1";
    const userResult = await pool.query(userQuery, [employee_id]);

    if (userResult.rows.length === 0) {
      await logEvent("Forgot Password", `Employee ID not found: ${employee_id}`);
      return res.status(404).json({ message: "Employee ID not found" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update the password
    const updateQuery = "UPDATE employee_master SET password = $1 WHERE employee_id = $2";
    await pool.query(updateQuery, [hashedPassword, employee_id]);

    console.log("✅ Password reset successful for:", employee_id);
    await logEvent("Forgot Password", `Password reset successful for: ${employee_id}`);
    return res.status(200).json({ message: "Password reset successfully" });

  } catch (error) {
    console.error("❌ Forgot Password Error:", error.message);
    await logEvent("Forgot Password", `Error for employee ID ${employee_id}: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET route: fetch tasks by status
app.get('/api/tasks/status/:status', async (req, res) => {
  const { status } = req.params;
  try {
    let queryText = '';
    let queryValues = [];

    if (status === 'finished') {
      queryText = `
        SELECT DISTINCT ON (at.id) at.*, wom.priority, 'finished' as status
        FROM assign_task at
        JOIN work_order_master wom ON at.control_number = wom.control_number
        JOIN part_master pm ON pm.part_number = ANY(at.part_number)
        WHERE pm.status = $1
        ORDER BY at.id, wom.priority DESC
      `;
      queryValues.push('finished');
    } else {
      queryText = `
        SELECT DISTINCT ON (at.id) at.*, wom.priority
        FROM assign_task at
        JOIN work_order_master wom ON at.control_number = wom.control_number
      `;
      if (status !== 'All') {
        queryText += ' WHERE at.status = $1';
        queryValues.push(status);
      }
      queryText += ' ORDER BY at.id, wom.priority DESC';
    }

    const result = await pool.query(queryText, queryValues);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET route: fetch control numbers that are not fully finished
app.get('/api/control-numbers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT pm.control_number
      FROM part_master pm
      GROUP BY pm.control_number
      HAVING COUNT(*) FILTER (WHERE pm.status IS DISTINCT FROM 'finished') > 0
      ORDER BY pm.control_number
    `);
    const controlNumbers = result.rows.map(row => row.control_number);
    res.json(controlNumbers);
  } catch (err) {
    console.error('Error fetching control numbers:', err);
    res.status(500).json({ error: 'Failed to load control numbers' });
  }
});

// PUT route: update selected control number status to finished
app.put('/api/control-numbers', async (req, res) => {
  const { control_number } = req.body;

  if (!control_number) {
    await logEvent('UPDATE_CONTROL_NUMBER_FAILED', 'Control number not provided');
    return res.status(400).json({ error: 'Control number is required' });
  }

  try {
    await pool.query('BEGIN');

    // Check for incomplete tasks
    const taskCheck = await pool.query(
      `SELECT COUNT(*) AS incomplete_count
       FROM assign_task
       WHERE control_number = $1 AND status != 'completed'`,
      [control_number]
    );

    if (parseInt(taskCheck.rows[0].incomplete_count) > 0) {
      await logEvent('CONTROL_FINISH_BLOCKED', `${control_number} has incomplete tasks`);
      await pool.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Not all tasks are completed under this control number.',
      });
    }

    // Calculate total_mandays and delayed_ontime
    const calcResult = await pool.query(
      `
      WITH task_periods AS (
        SELECT 
          at.control_number,
          GREATEST(at.start_date, COALESCE(at.actual_start_date::date, at.start_date)) AS period_start,
          CASE 
            WHEN at.status = 'completed' THEN at.actual_end_date::date
            ELSE LEAST(at.end_date, CURRENT_DATE)
          END AS period_end
        FROM assign_task at
        WHERE at.control_number = $1
      ),
      working_days_sum AS (
        SELECT 
          control_number,
          SUM(total_working_days) AS total_working_days_sum
        FROM assign_task
        WHERE control_number = $1
        GROUP BY control_number
      ),
      control_period AS (
        SELECT 
          control_number,
          MIN(period_start) AS overall_start,
          COALESCE(
            (SELECT MAX(pm.finished_date)::date 
             FROM part_master pm 
             WHERE pm.control_number = task_periods.control_number),
            MAX(period_end)
          ) AS overall_end
        FROM task_periods
        GROUP BY control_number
      ),
      total_days_calc AS (
        SELECT 
          cp.control_number,
          cp.overall_start,
          cp.overall_end,
          wom.desired_completion_date,
          wds.total_working_days_sum,
          CASE 
            WHEN cp.overall_end > wom.desired_completion_date 
            THEN 'Delayed'
            ELSE 'On Time'
          END AS delay_status
        FROM control_period cp
        JOIN work_order_master wom ON cp.control_number = wom.control_number
        JOIN working_days_sum wds ON cp.control_number = wds.control_number
      )
      SELECT 
        total_working_days_sum AS total_man_days,
        delay_status AS delayed_ontime
      FROM total_days_calc
      `,
      [control_number]
    );

    let total_man_days = null;
    let delayed_ontime = null;

    if (calcResult.rows.length > 0) {
      total_man_days = calcResult.rows[0].total_man_days;
      delayed_ontime = calcResult.rows[0].delayed_ontime;
    }

    // Update part_master with status, finished_date, total_mandays, and delayed_ontime
    const updateResult = await pool.query(
      `UPDATE part_master
       SET status = 'finished',
           finished_date = CURRENT_TIMESTAMP,
           total_man_days = $2,
           delayed_ontime = $3
       WHERE control_number = $1
       RETURNING control_number`,
      [control_number, total_man_days, delayed_ontime]
    );

    if (updateResult.rowCount === 0) {
      await logEvent('CONTROL_NUMBER_NOT_FOUND', `${control_number} not found`);
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Control number not found' });
    }

    await pool.query('COMMIT');
    await logEvent('CONTROL_MARKED_FINISHED', `${control_number} marked as finished`);
    res.json({ success: true, message: `${control_number} marked as finished` });
  } catch (err) {
    console.error('Error updating control number:', err);
    await pool.query('ROLLBACK');
    await logEvent('CONTROL_FINISH_ERROR', `Error updating ${control_number}: ${err.message}`);
    res.status(500).json({ error: 'Failed to update control number' });
  }
});

app.post("/update-job-status", async (req, res) => {
  const { id, status, reason } = req.body;

  if (!id || !status) {
    await logEvent("UPDATE_JOB_STATUS_FAILED", "Task ID or status not provided");
    return res.status(400).json({ success: false, message: "Task ID and status are required" });
  }

  try {
    await pool.query("BEGIN");

    let queryText = `
      UPDATE assign_task
      SET status = $1
    `;
    let queryValues = [status, id];

    if (status === "on hold" && reason) {
      queryText += `, hold_reason = $3, hold_start_date = CURRENT_TIMESTAMP`;
      queryValues.push(reason);
    } else if (status === "ongoing") {
      queryText += `, hold_reason = NULL, hold_start_date = NULL`;
    }

    queryText += ` WHERE id = $2 RETURNING id, status, hold_reason, hold_start_date`;

    const result = await pool.query(queryText, queryValues);

    if (result.rowCount === 0) {
      await logEvent("TASK_NOT_FOUND", `Task ID ${id} not found`);
      await pool.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    await pool.query("COMMIT");
    await logEvent("JOB_STATUS_UPDATED", `Task ${id} updated to status ${status}`);

    res.json({
      success: true,
      message: `Task status updated to ${status}`,
      hold_start_date: result.rows[0].hold_start_date,
    });
  } catch (err) {
    console.error("Error updating job status:", err);
    await pool.query("ROLLBACK");
    await logEvent("JOB_STATUS_UPDATE_ERROR", `Error updating task ${id}: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to update task status" });
  }
});

app.post("/logout", async (req, res) => {

  try {
    // Get employee_id from the request body
    const employeeId = req.body.employee_id || "Unknown Employee";

    await logEvent("LOGOUT", `Employee ${employeeId} logged out`);

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    await logEvent("LOGOUT_ERROR", `Error logging out employee: ${error.message}`);
    res.status(500).json({ success: false, message: "Error logging out" });
  }
});

//flutter
// Create a note
app.post('/api/notes', upload.single('voice'), async (req, res) => {
  const { employee_id, note_text, language } = req.body;
  const voice_path = req.file ? `uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      'INSERT INTO notes (employee_id, note_text, language, voice_path, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [employee_id, note_text || null, language || null, voice_path]
    );
    res.status(201).json({ success: true, note: result.rows[0] });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all notes for an employee
app.get('/api/notes/:employee_id', async (req, res) => {
  const { employee_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE employee_id = $1 ORDER BY created_at DESC',
      [employee_id]
    );
    res.status(200).json({ success: true, notes: result.rows });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const note = await pool.query('SELECT voice_path FROM notes WHERE id = $1', [id]);
    if (note.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    const voicePath = note.rows[0].voice_path;
    if (voicePath) {
      const filePath = path.join(__dirname, voicePath);
      try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete the file
        console.log(`Deleted file: ${filePath}`);
      } catch (fileError) {
        console.warn(`File not found or error deleting file: ${filePath}`, fileError);
      }
    }

    await pool.query('DELETE FROM notes WHERE id = $1', [id]);
    res.status(200).json({ success: true, message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

//TEST
// Endpoint to get list of employees (for dropdown)
app.get('/api/employees', async (req, res) => {
  try {
    const query = `
      SELECT employee_id, employee_name
      FROM employee_master
      ORDER BY employee_name;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
    console.log('✅ Fetched employee list');
  } catch (error) {
    console.error('❌ Error fetching employees:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Check if employee exists by employee_id
app.get('/api/employee-exists/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id.trim() === '') {
    return res.status(400).json({ success: false, error: 'Employee ID is required' });
  }

  try {
    const result = await pool.query(
      'SELECT employee_id, employee_name, designation, email_id FROM employee_master WHERE employee_id = $1',
      [id.trim()]
    );

    if (result.rows.length > 0) {
      res.json({ exists: true, employee: result.rows[0] });
      console.log(`✅ Found employee for ID: ${id}`);
    } else {
      res.json({ exists: false });
      console.log(`❌ No employee found for ID: ${id}`);
    }
  } catch (error) {
    console.error('❌ Error checking employee:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Endpoint to get employee report data (for frontend display)
app.get('/api/employee-report/:employeeId', async (req, res) => {
  const employeeId = parseInt(req.params.employeeId, 10);
  if (isNaN(employeeId)) {
    console.log('❌ Invalid employee ID received:', req.params.employeeId);
    return res.status(400).json({ success: false, message: 'Invalid employee ID' });
  }
  try {
    const employeeQuery = `
      SELECT employee_id, employee_name, designation, email_id
      FROM employee_master
      WHERE employee_id = $1;
    `;
    const tasksQuery = `
      SELECT 
        a.id, 
        a.control_number, 
        a.status,  
        a.part_number,  
        a.actual_start_date,
        a.actual_end_date,
        a.total_working_days,
        COALESCE(STRING_AGG(DISTINCT pm.description, ', '), 'No description') AS part_descriptions,
        w.group_section, 
        w.priority
      FROM assign_task a
      JOIN work_order_master w 
        ON a.control_number = w.control_number
      LEFT JOIN part_master pm 
        ON pm.part_number = ANY(a.part_number)
      WHERE a.employee_id = $1
      GROUP BY a.id, a.control_number, a.status, a.part_number, a.start_date, a.end_date, a.actual_end_date, a.total_working_days, w.group_section, w.priority;
    `;
    const [employeeResult, tasksResult] = await Promise.all([
      pool.query(employeeQuery, [employeeId]),
      pool.query(tasksQuery, [employeeId]),
    ]);
    if (employeeResult.rows.length === 0) {
      console.log('❌ No employee found for ID:', employeeId);
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({
      success: true,
      employee: employeeResult.rows[0],
      tasks: tasksResult.rows,
    });
    console.log(`✅ Fetched report data for employee ID: ${employeeId}`);
  } catch (error) {
    console.error('❌ Error fetching employee report:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/employee-report/:employeeId/:format', async (req, res) => {
  const employeeId = parseInt(req.params.employeeId, 10);
  const format = req.params.format.toLowerCase();

  if (isNaN(employeeId)) {
    return res.status(400).json({ success: false, message: 'Invalid employee ID' });
  }

  if (!['pdf', 'excel'].includes(format)) {
    return res.status(400).json({ success: false, message: "Invalid format. Use 'pdf' or 'excel'." });
  }

  try {
    // Fetch employee info
    const employeeQuery = `
      SELECT employee_id, employee_name, designation, email_id
      FROM employee_master
      WHERE employee_id = $1;
    `;
    const employeeResult = await pool.query(employeeQuery, [employeeId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Fetch tasks
    const tasksQuery = `
      SELECT 
        a.id, 
        a.control_number, 
        a.status,  
        a.part_number,  
        a.actual_start_date,
        a.actual_end_date,
        a.total_working_days,
        COALESCE(STRING_AGG(DISTINCT pm.description, ', '), 'No description') AS part_descriptions,
        w.group_section, 
        w.priority
      FROM assign_task a
      JOIN work_order_master w ON a.control_number = w.control_number
      LEFT JOIN part_master pm ON pm.part_number = ANY(a.part_number)
      WHERE a.employee_id = $1
      GROUP BY a.id, a.control_number, a.status, a.part_number, a.actual_start_date, a.actual_end_date, a.total_working_days, w.group_section, w.priority;
    `;
    const tasksResult = await pool.query(tasksQuery, [employeeId]);
    const tasks = tasksResult.rows;

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${employee.employee_name.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf`);
      doc.pipe(res);

      doc.fontSize(24).font('Helvetica-Bold').text('MSFlow Employee Work Report', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(16).font('Helvetica-Bold').text('Employee Details', { underline: true });
      doc.moveDown(1);

      const employeeTableTop = doc.y;
      const employeeColumnWidths = [120, 380];
      const rowHeight = 20;
      const tableData = [
        ['Employee Report', ''],
        ['Employee ID', employee.employee_id.toString()],
        ['Name', employee.employee_name],
        ['Designation', employee.designation],
        ['Email', employee.email_id],
      ];

      tableData.forEach((row, rowIndex) => {
        const y = employeeTableTop + rowIndex * rowHeight;
        row.forEach((cell, cellIndex) => {
          const x = 50 + employeeColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
          doc.fontSize(10)
            .font(rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
            .text(cell, x + 5, y + 4, {
              width: employeeColumnWidths[cellIndex] - 10,
              align: 'left',
            });
          doc.rect(x, y, employeeColumnWidths[cellIndex], rowHeight).stroke();
        });
      });

      doc.moveDown(2);
      doc.fontSize(16).font('Helvetica-Bold').text('Assigned Task Details', { underline: true });
      doc.moveDown(1);

      if (tasks.length === 0) {
        doc.fontSize(12).font('Helvetica').text('No tasks assigned.');
      } else {
        const taskTableTop = doc.y;
        const taskColumnWidths = [120, 380];
        const taskRowHeight = 20;
        let currentY = taskTableTop;

        tasks.forEach((task, taskIndex) => {
          const taskData = [
            ['Task ' + (taskIndex + 1), ''],
            ['Control Number', task.control_number || 'N/A'],
            ['Status', task.status || 'N/A'],
            ['Part Number(s)', Array.isArray(task.part_number) ? task.part_number.join(', ') : task.part_number || 'N/A'],
            ['Part Description(s)', task.part_descriptions || 'No description'],
            ['Actual Start Date', formatDateDDMMYYYY(task.actual_start_date)],
            ['Actual End Date', formatDateDDMMYYYY(task.actual_end_date)],
            ['Working Days', task.total_working_days?.toString() || 'N/A'],
            ['Group Section', task.group_section || 'N/A'],
            ['Priority', task.priority || 'N/A'],
          ];

          const requiredHeight = taskData.length * taskRowHeight;
          if (currentY + requiredHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            currentY = doc.page.margins.top;
          }

          taskData.forEach((row, rowIndex) => {
            const y = currentY + rowIndex * taskRowHeight;
            row.forEach((cell, cellIndex) => {
              const x = 50 + taskColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
              doc.fontSize(10)
                .font(rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
                .text(cell, x + 5, y + 4, {
                  width: taskColumnWidths[cellIndex] - 10,
                  align: 'left',
                });
              doc.rect(x, y, taskColumnWidths[cellIndex], taskRowHeight).stroke();
            });
          });

          currentY += taskData.length * taskRowHeight + 20;
        });
      }

      doc.end();
      console.log(`✅ PDF generated for employee ID: ${employeeId}`);
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Employee Report');

      worksheet.addRow(['Employee Report']);
      worksheet.addRow(['Employee ID', employee.employee_id]);
      worksheet.addRow(['Name', employee.employee_name]);
      worksheet.addRow(['Designation', employee.designation]);
      worksheet.addRow(['Email', employee.email_id]);
      worksheet.addRow([]);

      worksheet.addRow(['Assigned Tasks']);
      worksheet.addRow([
        'Control Number',
        'Status',
        'Part Number(s)',
        'Part Description(s)',
        'Actual Start Date',
        'Actual End Date',
        'Total Working Days',
        'Group Section',
        'Priority'
      ]);

      tasks.forEach(task => {
        worksheet.addRow([
          task.control_number || 'N/A',
          task.status || 'N/A',
          Array.isArray(task.part_number) ? task.part_number.join(', ') : task.part_number || 'N/A',
          task.part_descriptions || 'N/A',
          formatDateDDMMYYYY(task.actual_start_date),
          formatDateDDMMYYYY(task.actual_end_date),
          task.total_working_days || 'N/A',
          task.group_section || 'N/A',
          task.priority || 'N/A'
        ]);
      });

      worksheet.getRow(1).font = { bold: true, size: 16 };
      worksheet.getRow(7).font = { bold: true };
      worksheet.getRow(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
      worksheet.columns.forEach(column => {
        column.width = Math.max(15, column.header ? column.header.length + 5 : 10);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${employee.employee_name.replace(/[^a-zA-Z0-9]/g, '_')}_report.xlsx`);
      await workbook.xlsx.write(res);
      console.log(`✅ Excel generated for employee ID: ${employeeId}`);
    }
  } catch (error) {
    console.error(`❌ Error generating report:`, error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

//ASSIGN-TASK
// GET /api/control-status/:controlNumber
app.get("/api/control-status/:controlNumber", async (req, res) => {
  const { controlNumber } = req.params;

  try {
    const result = await pool.query(
      `SELECT status FROM part_master WHERE control_number = $1`,
      [controlNumber]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Control number not found" });
    }

    res.json({ status: result.rows[0].status });
  } catch (err) {
    console.error("Error checking control number:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Check if control number exists
app.get('/api/control-number-exists/:controlNumber', async (req, res) => {
  const { controlNumber } = req.params;
  try {
    const result = await pool.query(
      'SELECT control_number FROM work_order_master WHERE control_number = $1;',
      [controlNumber]
    );
    console.log('Query result:', result.rows); 
    if (result.rows.length > 0) {
      res.json({ exists: true, control_number: result.rows[0].control_number });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking control number:', error.message, error.stack);
    res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

// Fetch report data
app.get('/api/control-number-report-data/:controlNumber', async (req, res) => {
  const controlNumber = req.params.controlNumber;

  try {
    // Fetch work order details
    const workOrderQuery = `
      SELECT control_number, work_order_number, project_code, group_section, priority,
             product_description, work_order_date, desired_completion_date
      FROM work_order_master
      WHERE control_number = $1;
    `;
    const workOrderResult = await pool.query(workOrderQuery, [controlNumber]);

    if (workOrderResult.rows.length === 0) {
      console.log('❌ No work order found for control number:', controlNumber);
      return res.status(404).json({ success: false, message: 'Control number not found' });
    }

    const workOrder = workOrderResult.rows[0];

    // Fetch part details and employee details grouped by assignment_id
    const groupQuery = `
      SELECT at.assignment_id,
             STRING_AGG(DISTINCT em.employee_name, ', ') AS employee_names,
             ARRAY_AGG(DISTINCT jsonb_build_object(
               'part_number', pm.part_number,
               'description', pm.description,
               'quantity', pm.quantity,
               'finished_date', pm.finished_date
             )) AS parts
      FROM assign_task at
      JOIN employee_master em ON em.employee_id = at.employee_id
      LEFT JOIN part_master pm ON pm.control_number = at.control_number
        AND pm.part_number = ANY(at.part_number)
      WHERE at.control_number = $1
      GROUP BY at.assignment_id
      ORDER BY at.assignment_id;
    `;
    const groupResult = await pool.query(groupQuery, [controlNumber]);
    const groups = groupResult.rows.map(group => ({
      assignment_id: group.assignment_id,
      employeeNames: group.employee_names || 'N/A',
      parts: group.parts.filter(part => part.part_number).map(part => ({
        partNumber: part.part_number || 'N/A',
        description: part.description || 'N/A',
        quantity: part.quantity?.toString() || 'N/A',
        finishedDate: part.finished_date ? new Date(part.finished_date).toISOString().split('T')[0] : 'N/A',
      })),
    }));

    // Aggregate total_man_days and delayed_ontime from part_master
    const partQuery = `
      SELECT total_man_days, delayed_ontime
      FROM part_master
      WHERE control_number = $1;
    `;
    const partResult = await pool.query(partQuery, [controlNumber]);
    const totalManDays = partResult.rows.reduce((sum, part) => sum + (part.total_man_days || 0), 0) || 'N/A';
    const delayedOnTime = partResult.rows.length > 0 ? partResult.rows[0].delayed_ontime || 'N/A' : 'N/A';

    // Structure the response
    const responseData = {
      success: true,
      workOrder: {
        controlNumber: workOrder.control_number || 'N/A',
        workOrderNumber: workOrder.work_order_number || 'N/A',
        projectCode: workOrder.project_code || 'N/A',
        groupSection: workOrder.group_section || 'N/A',
        priority: workOrder.priority || 'N/A',
        productDescription: workOrder.product_description || 'N/A',
        workOrderDate: workOrder.work_order_date ? new Date(workOrder.work_order_date).toISOString().split('T')[0] : 'N/A',
        desiredCompletionDate: workOrder.desired_completion_date ? new Date(workOrder.desired_completion_date).toISOString().split('T')[0] : 'N/A',
        totalManDays,
        delayedOnTime,
      },
      groups,
    };

    console.log(`✅ Fetched report data for control number: ${controlNumber}`);
    res.status(200).json(responseData);
  } catch (error) {
    console.error(`❌ Error fetching report data for control number ${controlNumber}:`, error);
    res.status(500).json({ success: false, message: `Internal server error: ${error.message}` });
  }
});

// Generate report in PDF or Excel
app.get('/api/control-number-report/:controlNumber/:format', async (req, res) => {
  const controlNumber = req.params.controlNumber;
  const format = req.params.format.toLowerCase();

  if (!['pdf', 'excel'].includes(format)) {
    console.log('❌ Invalid format received:', format);
    return res.status(400).json({ success: false, message: "Invalid format. Use 'pdf' or 'excel'." });
  }

  try {
    // Fetch work order details
    const workOrderQuery = `
      SELECT control_number, work_order_number, project_code, group_section, priority,
             product_description, work_order_date, desired_completion_date
      FROM work_order_master
      WHERE control_number = $1;
    `;
    const workOrderResult = await pool.query(workOrderQuery, [controlNumber]);

    if (workOrderResult.rows.length === 0) {
      console.log('❌ No work order found for control number:', controlNumber);
      return res.status(404).json({ success: false, message: 'Control number not found' });
    }

    const workOrder = workOrderResult.rows[0];

    // Fetch grouped data
    const groupQuery = `
      SELECT at.assignment_id,
             STRING_AGG(DISTINCT em.employee_name, ', ') AS employee_names,
             ARRAY_AGG(DISTINCT jsonb_build_object(
               'part_number', pm.part_number,
               'description', pm.description,
               'quantity', pm.quantity,
               'finished_date', pm.finished_date
             )) AS parts
      FROM assign_task at
      JOIN employee_master em ON em.employee_id = at.employee_id
      LEFT JOIN part_master pm ON pm.control_number = at.control_number
        AND pm.part_number = ANY(at.part_number)
      WHERE at.control_number = $1
      GROUP BY at.assignment_id
      ORDER BY at.assignment_id;
    `;
    const groupResult = await pool.query(groupQuery, [controlNumber]);
    const groups = groupResult.rows.map(group => ({
      assignment_id: group.assignment_id,
      employee_names: group.employee_names || 'N/A',
      parts: group.parts.filter(part => part.part_number),
    }));

    // Aggregate total_man_days and delayed_ontime
    const partQuery = `
      SELECT total_man_days, delayed_ontime
      FROM part_master
      WHERE control_number = $1;
    `;
    const partResult = await pool.query(partQuery, [controlNumber]);
    const totalManDays = partResult.rows.reduce((sum, part) => sum + (part.total_man_days || 0), 0) || 'N/A';
    const delayedOnTime = partResult.rows.length > 0 ? partResult.rows[0].delayed_ontime || 'N/A' : 'N/A';

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      let isResponseEnded = false;

      // Set headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=control_number_${controlNumber}_report.pdf`);

      // Handle stream errors
      doc.on('error', (err) => {
        if (!isResponseEnded) {
          console.error(`❌ PDF stream error for control number ${controlNumber}:`, err);
          res.status(500).json({ success: false, message: `PDF generation error: ${err.message}` });
          isResponseEnded = true;
        }
      });

      res.on('error', (err) => {
        console.error(`❌ Response stream error for control number ${controlNumber}:`, err);
      });

      doc.pipe(res);

      // Main Heading
      doc.fontSize(24).font('Helvetica-Bold').text('MSFlow Control Number Report', { align: 'center' });
      doc.moveDown(2);

      // Work Order Details
      doc.fontSize(16).font('Helvetica-Bold').text('Work Order Details', { underline: true });
      doc.moveDown(1);

      const workOrderTableTop = doc.y;
      const columnWidths = [120, 380];
      const rowHeight = 20;
      const workOrderData = [
        ['Control Number', workOrder.control_number || 'N/A'],
        ['Work Order Number', workOrder.work_order_number || 'N/A'],
        ['Project Code', workOrder.project_code || 'N/A'],
        ['Group Section', workOrder.group_section || 'N/A'],
        ['Priority', workOrder.priority || 'N/A'],
        ['Product Description', workOrder.product_description || 'N/A'],
        ['Work Order Date', workOrder.work_order_date ? new Date(workOrder.work_order_date).toISOString().split('T')[0] : 'N/A'],
        ['Desired Completion Date', workOrder.desired_completion_date ? new Date(workOrder.desired_completion_date).toISOString().split('T')[0] : 'N/A'],
        ['Total Man Days', totalManDays.toString()],
        ['Delay Status', delayedOnTime],
      ];

      workOrderData.forEach((row, rowIndex) => {
        const y = workOrderTableTop + rowIndex * rowHeight;
        row.forEach((cell, cellIndex) => {
          const x = 50 + columnWidths.slice(0, cellIndex).reduce((sum, width) => sum + width, 0);
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(cell, x + 5, y + 4, {
              width: columnWidths[cellIndex] - 10,
              align: 'left',
              height: rowHeight,
              ellipsis: true,
            });
          doc
            .rect(x, y, columnWidths[cellIndex], rowHeight)
            .stroke();
        });
      });

      doc.moveDown(2);
      doc.fontSize(16).font('Helvetica-Bold').text('Part and Employee Details', { underline: true });
      doc.moveDown(1);

      if (groups.length === 0) {
        doc.fontSize(12).font('Helvetica').text('No parts or employee groups found.', 50, doc.y);
      } else {
        let currentY = doc.y;
        const tableColumnWidths = [100, 150, 80, 100, 100];
        const tableRowHeight = 20;

        groups.forEach((group, groupIndex) => {
          // Ensure heading aligns with table's left edge
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(`Part ${groupIndex + 1}`, 50, currentY, { align: 'left' });
          currentY += 20; // Increased spacing for clarity

          // Table Header
          const headers = ['Part Number', 'Description', 'Quantity', 'Finished Date', 'Employee Names'];
          headers.forEach((header, headerIndex) => {
            const x = 50 + tableColumnWidths.slice(0, headerIndex).reduce((sum, width) => sum + width, 0);
            doc
              .fontSize(10)
              .font('Helvetica-Bold')
              .text(header, x + 5, currentY + 4, {
                width: tableColumnWidths[headerIndex] - 10,
                align: 'left',
                height: tableRowHeight,
              });
            doc
              .rect(x, currentY, tableColumnWidths[headerIndex], tableRowHeight)
              .stroke();
          });
          currentY += tableRowHeight;

          // Table Rows
          if (group.parts.length === 0) {
            const x = 50;
            doc
              .fontSize(10)
              .font('Helvetica')
              .text('No parts found.', x + 5, currentY + 4, {
                width: tableColumnWidths.reduce((sum, width) => sum + width, 0) - 10,
                align: 'center',
                height: tableRowHeight,
              });
            doc
              .rect(x, currentY, tableColumnWidths.reduce((sum, width) => sum + width, 0), tableRowHeight)
              .stroke();
            currentY += tableRowHeight;
          } else {
            group.parts.forEach((part, partIndex) => {
              const rowData = [
                part.part_number || 'N/A',
                part.description || 'N/A',
                part.quantity?.toString() || 'N/A',
                part.finished_date ? new Date(part.finished_date).toISOString().split('T')[0] : 'N/A',
                partIndex === 0 ? group.employee_names : '',
              ];
              rowData.forEach((cell, cellIndex) => {
                const x = 50 + tableColumnWidths.slice(0, cellIndex).reduce((sum, width) => sum + width, 0);
                doc
                  .fontSize(10)
                  .font('Helvetica')
                  .text(cell, x + 5, currentY + 4, {
                    width: tableColumnWidths[cellIndex] - 10,
                    align: 'left',
                    height: tableRowHeight,
                    ellipsis: true,
                  });
                doc
                  .rect(x, currentY, tableColumnWidths[cellIndex], tableRowHeight)
                  .stroke();
              });
              currentY += tableRowHeight;
            });
          }

          currentY += 20;
          if (currentY > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            currentY = doc.page.margins.top;
          }
        });
      }

      doc.end();
      console.log(`✅ Generated PDF report for control number: ${controlNumber}`);
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Control Number Report');

      // Work Order Details
      worksheet.addRow(['Control Number Report']).font = { bold: true, size: 16 };
      worksheet.addRow(['Control Number', workOrder.control_number || 'N/A']);
      worksheet.addRow(['Work Order Number', workOrder.work_order_number || 'N/A']);
      worksheet.addRow(['Project Code', workOrder.project_code || 'N/A']);
      worksheet.addRow(['Group Section', workOrder.group_section || 'N/A']);
      worksheet.addRow(['Priority', workOrder.priority || 'N/A']);
      worksheet.addRow(['Product Description', workOrder.product_description || 'N/A']);
      worksheet.addRow(['Work Order Date', workOrder.work_order_date ? new Date(workOrder.work_order_date).toISOString().split('T')[0] : 'N/A']);
      worksheet.addRow(['Desired Completion Date', workOrder.desired_completion_date ? new Date(workOrder.desired_completion_date).toISOString().split('T')[0] : 'N/A']);
      worksheet.addRow(['Total Man Days', totalManDays]);
      worksheet.addRow(['Delay Status', delayedOnTime]);
      worksheet.addRow([]);

      // Part and Employee Details
      worksheet.addRow(['Part and Employee Details']).font = { bold: true };
      if (groups.length === 0) {
        worksheet.addRow(['No parts or employee groups found']);
      } else {
        groups.forEach((group, groupIndex) => {
          worksheet.addRow([`Assignment ID: ${group.assignment_id || `Group ${groupIndex + 1}`}`]).font = { bold: true };
          worksheet.addRow(['Part Number', 'Description', 'Quantity', 'Finished Date', 'Employee Names']).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
          if (group.parts.length === 0) {
            worksheet.addRow(['No parts found', '', '', '', '']);
          } else {
            group.parts.forEach((part, partIndex) => {
              worksheet.addRow([
                part.part_number || 'N/A',
                part.description || 'N/A',
                part.quantity || 'N/A',
                part.finished_date ? new Date(part.finished_date).toISOString().split('T')[0] : 'N/A',
                partIndex === 0 ? group.employee_names : '',
              ]);
            });
          }
          worksheet.addRow([]);
        });
      }

      worksheet.columns.forEach(column => {
        column.width = Math.max(15, column.header ? column.header.length + 5 : 10);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=control_number_${controlNumber}_report.xlsx`);
      await workbook.xlsx.write(res);
      console.log(`✅ Generated Excel report for control number: ${controlNumber}`);
    }
  } catch (error) {
    console.error(`❌ Error generating ${format} report for control number ${controlNumber}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: `Internal server error: ${error.message}` });
    }
  }
});
// API endpoint to count employees where is_group is false
app.get('/api/employee_count', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT COUNT(*) AS total_employees FROM employee_master WHERE is_group = false"
    );
    const count = parseInt(result.rows[0].total_employees);
    res.json({ success: true, total_employees: count });
    client.release();
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/completed_task_count', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS completedCount FROM assign_task WHERE status = 'completed'");
    res.json({ completedCount: parseInt(result.rows[0].completedcount, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to count completed tasks' });
  }
});

app.post('/update-material-detail', async (req, res) => {
  const { id, material_detail, work_remarks } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Job ID is required' });
  }

  let client;
  try {
    client = await pool.connect();

    const updateQuery = `
      UPDATE assign_task 
      SET material_detail = $1, work_remarks = $2
      WHERE id = $3
      RETURNING id, material_detail, work_remarks;
    `;
    const result = await client.query(updateQuery, [material_detail || null, work_remarks || null, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Material details and work remarks updated successfully',
      material_detail: result.rows[0].material_detail,
      work_remarks: result.rows[0].work_remarks
    });
  } catch (error) {
    console.error('Error updating material detail and work remarks:', error);
    res.status(500).json({ success: false, message: `Failed to update material detail and work remarks: ${error.message}` });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/task-status/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "Invalid ID parameter" });
  }

  try {
    const result = await pool.query(
      `SELECT id, status FROM assign_task WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    return res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        status: result.rows[0].status,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/leave_requests/:employee_id", async (req, res) => {
  const { employee_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
         lr.id,
         lr.start_date,
         lr.end_date,
         lm.leave_type,       
         lr.reason,
         lr.status,
         lr.half_day_period
       FROM leave_request lr
       JOIN leave_master lm ON lr.leave_type = lm.id
       WHERE lr.emp_id = $1
       ORDER BY lr.start_date DESC`,
      [employee_id]
    );

    res.json({ success: true, leaves: result.rows });
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// GET all QC employees
app.get('/api/qc-employees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT employee_id, employee_name FROM qc_master ORDER BY employee_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching QC employees:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ✅ API to get all groups
app.get("/api/group-master", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, group_name FROM group_master ORDER BY group_name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌍 API URL: ${API_URL}`);
});

