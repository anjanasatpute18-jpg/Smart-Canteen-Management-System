const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
const PORT = 5000;

// CORS
app.use(cors());

// JSON
app.use(express.json());

// Upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname) || ".jpg";
        const filename = Date.now() + extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage
});
// Home
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Smart Canteen Backend is running"
    });
});

// Food Detection
app.post("/detect", upload.single("image"), (req, res) => {

    console.log("Detection request received");

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: "No image uploaded"
        });
    }

    console.log("Image received:", req.file.path);

    const imagePath = req.file.path;

    const python = spawn(
        "python",
        ["detect.py", imagePath]
    );

    let output = "";
    let error = "";

    python.stdout.on("data", (data) => {
        output += data.toString();
    });

    python.stderr.on("data", (data) => {
        error += data.toString();
    });

    python.on("close", (code) => {

        console.log("Python finished with code:", code);

        if (code !== 0) {

            console.error("Python Error:", error);

            return res.status(500).json({
                success: false,
                error: error
            });
        }

        console.log("Detection Output:", output);

        res.json({
            success: true,
            detection: output.trim()
        });
    });
});

// Start server
app.get("/api/foods", (req, res) => {
    res.json([
        { id: 1, name: "Tea", price: 10 },
        { id: 2, name: "Coffee", price: 20 },
        { id: 3, name: "Poha", price: 30 },
        { id: 4, name: "Upma", price: 30 },
        { id: 5, name: "Vada Pav", price: 20 },
        { id: 6, name: "Samosa", price: 20 },
        { id: 7, name: "Water Bottle", price: 20 },
        { id: 8, name: "Fizz Jeera Soda", price: 30 },
        { id: 9, name: "Sprite", price: 30 },
        { id: 10, name: "Thums Up", price: 30 },
        { id: 11, name: "Cornetto Ice Cream", price: 40 },
        { id: 12, name: "Chocobar Ice Cream", price: 30 },
        { id: 13, name: "Pani Puri", price: 40 },
        { id: 14, name: "Bhel", price: 40 },
        { id: 15, name: "Samosa chaat", price: 40 },
        { id: 16, name: "Veg Thali", price: 100 },
        { id: 17, name: "Dahi Puri", price: 50 },
        { id: 18, name: "Misal Pav", price: 60 },
        { id: 19, name: "Pav Bhaji", price: 70 },
        { id: 20, name: "Idli", price: 40 },
        { id: 21, name: "Dosa", price: 60 },
        { id: 22, name: "Lassi", price: 40 },
        { id: 23, name: "Puri Bhaji", price: 60 },
        { id: 24, name: "Maaza", price: 30 },
        { id: 25, name: "cup ice cream", price: 30 },
        { id: 26, name: "Potato chips", price: 20 },
        { id: 27, name: "Tedhe Medhe", price: 20 },
        { id: 28, name: "Dark Chocolate", price: 50 },
        { id: 29, name: "Dairy Milk", price: 50 },
        { id: 30, name: "5 Star", price: 30 },
        { id: 31, name: "pulse", price: 10 },
        { id: 32, name: "Masala chips", price: 20 },
        { id: 33, name: "Tomato Chips", price: 20 }
    ]);
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});