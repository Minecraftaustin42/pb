const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3002;

const USERS_FILE = path.join(__dirname, "users.json");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    }

    const data = fs.readFileSync(USERS_FILE, "utf8");

    if (!data.trim()) {
        return [];
    }

    return JSON.parse(data);
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post("/signup", async (req, res) => {
    try {
        const { username, password, confirm } = req.body;

        if (!username || !password || !confirm) {
            return res.send("Missing signup info. <a href='/signup.html'>Go back</a>");
        }

        if (password !== confirm) {
            return res.send("Passwords do not match. <a href='/signup.html'>Try again</a>");
        }

        if (username.length < 3) {
            return res.send("Username must be at least 3 characters. <a href='/signup.html'>Try again</a>");
        }

        if (password.length < 6) {
            return res.send("Password must be at least 6 characters. <a href='/signup.html'>Try again</a>");
        }

        const users = loadUsers();

        const existingUser = users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        );

        if (existingUser) {
            return res.send("Username already taken. <a href='/signup.html'>Try again</a>");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString(),
            username: username,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);

        res.send(`
            <h1>Welcome to Playsculpt, ${username}!</h1>
            <p>Your account was created.</p>
            <p>You are ready to enter Sculpt City.</p>
            <a href="/login.html">Go to Login</a>
        `);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error.");
    }
});

app.listen(PORT, () => {
    console.log(`Playsculpt server running on http://localhost:${PORT}`);
});