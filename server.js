const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3002;

const USERS_FILE = path.join(__dirname, "users.json");
const ONBOARDING_FILE = path.join(__dirname, "onboardingprogress.json");
const BADGES_FILE = path.join(__dirname, "badges.json");
const COINS_FILE = path.join(__dirname, "sculptcoins.json");
const HOUSES_FILE = path.join(__dirname, "houses.json");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureFile(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback = []) {
  ensureFile(filePath, fallback);
  const data = fs.readFileSync(filePath, "utf8");
  if (!data.trim()) return fallback;
  return JSON.parse(data);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadUsers() {
  return readJson(USERS_FILE, []);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function getUsername(req) {
  return (req.query.username || req.body.username || "").trim();
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
    const existingUser = users.find((user) => user.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      return res.send("Username already taken. <a href='/signup.html'>Try again</a>");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    return res.redirect(`/sculptcity.html?username=${encodeURIComponent(username)}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error.");
  }
});

app.get("/api/onboarding", (req, res) => {
  const username = getUsername(req);
  if (!username) return res.status(400).json({ error: "username required" });

  const progress = readJson(ONBOARDING_FILE, []);
  const badges = readJson(BADGES_FILE, []);
  const coins = readJson(COINS_FILE, []);
  const houses = readJson(HOUSES_FILE, []);

  const userProgress = progress.find((x) => x.username.toLowerCase() === username.toLowerCase()) || null;
  const userBadges = badges.filter((x) => x.username.toLowerCase() === username.toLowerCase());
  const userCoins = coins.find((x) => x.username.toLowerCase() === username.toLowerCase()) || { username, balance: 0 };
  const userHouse = houses.find((x) => x.owner.toLowerCase() === username.toLowerCase()) || null;

  res.json({ username, progress: userProgress, badges: userBadges, coins: userCoins, userHouse, houses });
});

app.post("/api/onboarding/complete", (req, res) => {
  const username = getUsername(req);
  if (!username) return res.status(400).json({ error: "username required" });

  const progress = readJson(ONBOARDING_FILE, []);
  const badges = readJson(BADGES_FILE, []);
  const coins = readJson(COINS_FILE, []);

  let userProgress = progress.find((x) => x.username.toLowerCase() === username.toLowerCase());
  const now = new Date().toISOString();
  if (!userProgress) {
    userProgress = { username, completed: true, completedAt: now, homeClaimed: false, rewardGranted: true };
    progress.push(userProgress);
  } else {
    userProgress.completed = true;
    userProgress.completedAt = now;
    userProgress.rewardGranted = true;
  }

  if (!badges.find((x) => x.username.toLowerCase() === username.toLowerCase() && x.badgeId === "welcome-creator")) {
    badges.push({ username, badgeId: "welcome-creator", name: "Sculpt City Welcome Badge", grantedAt: now });
  }

  const coinReward = 150;
  const existingCoin = coins.find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!existingCoin) {
    coins.push({ username, balance: coinReward, updatedAt: now });
  } else if (!existingCoin.welcomeRewardClaimed) {
    existingCoin.balance = Number(existingCoin.balance || 0) + coinReward;
    existingCoin.updatedAt = now;
    existingCoin.welcomeRewardClaimed = true;
  }

  writeJson(ONBOARDING_FILE, progress);
  writeJson(BADGES_FILE, badges);
  writeJson(COINS_FILE, coins);

  res.json({ success: true, reward: coinReward });
});

app.post("/api/houses/claim", (req, res) => {
  const username = getUsername(req);
  const slot = Number(req.body.slot);
  if (!username) return res.status(400).json({ error: "username required" });
  if (Number.isNaN(slot)) return res.status(400).json({ error: "house slot required" });

  const houses = readJson(HOUSES_FILE, []);
  const progress = readJson(ONBOARDING_FILE, []);

  const existingOwned = houses.find((h) => h.owner.toLowerCase() === username.toLowerCase());
  if (existingOwned) return res.json({ success: true, house: existingOwned, houses });

  if (houses.find((h) => h.slot === slot)) {
    return res.status(409).json({ error: "This home was already claimed. Pick another." });
  }

  const house = { slot, owner: username, claimedAt: new Date().toISOString(), lightsOn: true };
  houses.push(house);
  writeJson(HOUSES_FILE, houses);

  const existingProgress = progress.find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (existingProgress) {
    existingProgress.homeClaimed = true;
    existingProgress.claimedSlot = slot;
  } else {
    progress.push({ username, completed: false, homeClaimed: true, claimedSlot: slot, rewardGranted: false });
  }
  writeJson(ONBOARDING_FILE, progress);

  res.json({ success: true, house, houses });
});

app.listen(PORT, () => {
  console.log(`Playsculpt server running on http://localhost:${PORT}`);
});
