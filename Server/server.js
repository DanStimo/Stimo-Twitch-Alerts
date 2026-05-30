require("dotenv").config();

const tmi = require("tmi.js");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const twitchClient = new tmi.Client({
    options: { debug: true },

    identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: process.env.TWITCH_IRC_TOKEN
    },

    channels: [
        process.env.TWITCH_CHANNEL
    ]
});

twitchClient.connect();

function rollCard() {
    const cards = loadCards();

    if (!cards || cards.length === 0) {
        throw new Error("cards.json is empty");
    }

    const roll = Math.random() * 100;

    let rarity = "common";

    if (roll <= 1) {
        rarity = "legendary";
    } else if (roll <= 5) {
        rarity = "epic";
    } else if (roll <= 15) {
        rarity = "rare";
    } else if (roll <= 40) {
        rarity = "uncommon";
    }

    let pool = cards.filter(c => c.rarity === rarity);

    if (pool.length === 0) {
        console.log(`No cards found for rarity: ${rarity}. Falling back to common.`);
        pool = cards.filter(c => c.rarity === "common");
    }

    if (pool.length === 0) {
        console.log("No common cards found. Falling back to any card.");
        pool = cards;
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;
const MODERATOR_ID = process.env.TWITCH_MODERATOR_ID;
const HISTORY_FILE = path.join(__dirname, "alert-history.json");

function getDefaultHistory() {
    return {
        follows: [],
        subs: [],
        primesubs: [],
        bits: [],
        raids: [],
        redemptions: [],
        giftsubs: [],
        tips: [],
        totals: {
            follows: 0,
            subs: 0,
            primesubs: 0,
            bits: 0,
            raids: 0,
            redemptions: 0,
            giftsubs: 0,
            totalBits: 0,
            totalRaidViewers: 0
        }
    };
}

function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(getDefaultHistory(), null, 2));
        }

        return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    } catch (err) {
        console.log("Could not load alert-history.json:", err.message);
        return getDefaultHistory();
    }
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function recordAlert(type, user, extra = "", reward = "") {
    const history = loadHistory();

    history.follows ||= [];
    history.subs ||= [];
    history.primesubs ||= [];
    history.bits ||= [];
    history.raids ||= [];
    history.redemptions ||= [];
    history.giftsubs ||= [];
    history.tips ||= [];

    history.totals ||= {};
    history.totals.follows ||= 0;
    history.totals.subs ||= 0;
    history.totals.primesubs ||= 0;
    history.totals.bits ||= 0;
    history.totals.raids ||= 0;
    history.totals.redemptions ||= 0;
    history.totals.giftsubs ||= 0;
    history.totals.totalBits ||= 0;
    history.totals.totalRaidViewers ||= 0;

    const entry = {
        user,
        extra,
        reward,
        time: new Date().toISOString()
    };

    if (type === "follow") {
        history.follows.unshift(entry);
        history.follows = history.follows.slice(0, 5);
        history.totals.follows++;
    }

    if (type === "giftsub") {
        history.giftsubs.unshift(entry);
        history.giftsubs = history.giftsubs.slice(0, 5);
        history.totals.giftsubs++;
    }

    if (type === "sub") {
        history.subs.unshift(entry);
        history.subs = history.subs.slice(0, 5);
        history.totals.subs++;
    }

    if (type === "primesub") {
        history.primesubs.unshift(entry);
        history.primesubs = history.primesubs.slice(0, 5);
        history.totals.primesubs++;
    }

    if (type === "bits") {
        history.bits.unshift(entry);
        history.bits = history.bits.slice(0, 5);
        history.totals.bits++;

        const bitAmount = parseInt(extra, 10) || 0;
        history.totals.totalBits += bitAmount;
    }

    if (type === "raid") {
        history.raids.unshift(entry);
        history.raids = history.raids.slice(0, 5);
        history.totals.raids++;

        const viewers = parseInt(extra, 10) || 0;
        history.totals.totalRaidViewers += viewers;
    }

    if (type === "redemption") {
        history.redemptions.unshift(entry);
        history.redemptions = history.redemptions.slice(0, 5);
        history.totals.redemptions++;
    }

    if (type === "tip") {
        history.tips.unshift(entry);
        history.tips = history.tips.slice(0, 5);
    }

    saveHistory(history);
    return history;
}

app.use((req, res, next) => {
    if (req.url === "/" || req.url.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
    }

    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("../overlay"));

const twitchChat = new tmi.Client({
    connection: {
        reconnect: true,
        secure: true
    },

    channels: ["stimo"]
});

twitchChat.connect();
twitchChat.on("connected", () => {
    console.log("[TWITCH CHAT] Connected to stimo");
});

twitchChat.on("message", (channel, tags, message, self) => {
console.log("[TWITCH CHAT]", tags["display-name"], message);
console.log("[TWITCH CHAT MSG]", tags["display-name"], message);

    if (self) return;

    const username = tags["display-name"] || tags.username;
    const login = tags.username;
    
    if (message.trim().toLowerCase() === "!openpack") {
        const collections = loadCollections();
    
        if (!collections[login] || collections[login].packs <= 0) {
            twitchClient.say(channel, `@${username} you don't have any packs to open yet.`);
            return;
        }
    
        const card = rollCard();
    
        collections[login].packs--;
    
        if (!collections[login].cards) {
            collections[login].cards = {};
        }
    
        collections[login].cards[card.name] =
            (collections[login].cards[card.name] || 0) + 1;
    
        saveCollections(collections);
    
        io.emit("card_pull", {
            user: username,
            card
        });
    
        twitchClient.say(
            channel,
            `@${username} opened a pack and pulled ${card.name} (${card.rarity})! Packs left: ${collections[login].packs}`
        );
    
        return;
    }

    io.emit("chat-message", {
        user: tags["display-name"] || tags.username,
        message: message,
        color: tags.color || "#00d9ff",
        emotes: tags.emotes || {}
    });

});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});

io.on("connection", (socket) => {
    console.log("Overlay connected");

});

app.get("/api/alert-history", (req, res) => {
    res.json(loadHistory());
});

app.get("/webhook/kofi", (req, res) => {
    res.send("Ko-fi webhook is online. Waiting for POST requests.");
});
app.post("/webhook/kofi", (req, res) => {
    try {
        const payload = req.body.data
            ? JSON.parse(req.body.data)
            : req.body;

        if (payload.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
            console.log("Invalid Ko-fi verification token");
            return res.status(403).send("Invalid token");
        }

        const fromName = payload.from_name || "Anonymous";
        const amount = payload.amount || "0";
        const currency = payload.currency || "";
        const message = payload.message || "";

        const tipText = `£${amount}`;

        const history = recordAlert(
            "tip",
            fromName,
            tipText,
            message
        );

        queueAlert(
            "tip",
            fromName,
            tipText,
            message,
            history
        );

        announceChat(`@${fromName} tipped ${tipText}! Thank you!`);

        res.status(200).send("OK");
    } catch (err) {
        console.log("Ko-fi webhook error:", err.message);
        res.status(500).send("Ko-fi webhook error");
    }
});

app.get("/test/openpack", (req, res) => {

    const card = rollCard();

    io.emit("card_pull", {
        user: "TestUser",
        card
    });

    res.send(`Opened test pack: ${card.name}`);
});

app.get("/test/:type", (req, res) => {
    const type = req.params.type;

    const testAlerts = {
        follow: {
            type: "follow",
            user: "TestFollower"
        },

        giftsub: {
            type: "giftsub",
            user: "TESTGIFTER ◆ TESTRECEIVER",
            extra: "TESTGIFTER",
            reward: "TESTRECEIVER"
        },

        multigiftsub: (() => {

            const giftCount = Math.floor(Math.random() * 10) + 2;

            return {
                type: "giftsub",
                user: `TESTGIFTER GIFTED x${giftCount}`,
                extra: `${giftCount} GIFT SUBS`,
                reward: ""
            };

        })(),

        sub: {
            type: "sub",
            user: "TestSub",
            extra: "25 MONTHS"
        },
        primesub: {
            type: "primesub",
            user: "TestPrime",
            extra: "12 MONTHS"
        },
        raid: {
            type: "raid",
            user: "TestRaider",
            extra: "25 viewers"
        },
        bits: {
            type: "bits",
            user: "TestCheerer",
            extra: "100 bits"
        },
        redemption: {
            type: "redemption",
            user: "TestRedeemer",
            reward: "Hydrate",
            extra: "Drink water!"
        },
        tip: {
            type: "tip",
            user: "TestTipper",
            extra: "£5.00",
            reward: "Great stream!"
        }
    };

    const alert = testAlerts[type];

    if (!alert) {
        return res.send("Unknown test alert type.");
    }

    const history = recordAlert(
        alert.type,
        alert.user,
        alert.extra || "",
        alert.reward || ""
    );

    queueAlert(
        alert.type,
        alert.user,
        alert.extra || "",
        alert.reward || "",
        history
    );

    res.send(`Test alert sent: ${type}`);
});

const alertQueue = [];
let alertPlaying = false;

const alertDurations = {
    follow: 7000,
    sub: 15000,
    primesub: 15000,
    giftsub: 15000,
    raid: 20500,
    bits: 9000,
    redemption: 9000,
    tip: 11000
};

function queueAlert(type, user, extra = "", reward = "", history = null) {
    
    alertQueue.push({
        type,
        user,
        extra,
        reward,
        history: history || loadHistory(),
        duration: alertDurations[type] || 5000
    });

    playNextAlert();
}

function playNextAlert() {
    if (alertPlaying) return;
    if (alertQueue.length === 0) return;

    alertPlaying = true;

    const nextAlert = alertQueue.shift();

    io.emit("alert", nextAlert);

    setTimeout(() => {
        alertPlaying = false;
        playNextAlert();
    }, nextAlert.duration || 5000);
}

async function createSubscription(type, version, condition, sessionId) {
    const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
            "Client-ID": CLIENT_ID,
            "Authorization": `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type,
            version,
            condition,
            transport: {
                method: "websocket",
                session_id: sessionId
            }
        })
    });

    const text = await res.text();

    if (!res.ok) {
        console.log(`❌ Failed subscribing to ${type}:`, res.status, text);
        return;
    }

    console.log(`✅ Subscribed to ${type}`);
}

async function getFollowerCount() {
    try {
        const res = await fetch(
            `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                }
            }
        );

        const data = await res.json();
        console.log("FOLLOWER API RESPONSE:", data);

        if (!res.ok) {
            console.log("Follower count failed:", data);
            return null;
        }

        return data.total;
    } catch (err) {
        console.log("Follower count error:", err.message);
        return null;
    }
}

function announceChat(message) {
    const channel = process.env.TWITCH_CHANNEL;

    twitchClient.say(channel, `/announce ${message}`)
        .catch(err => {
            console.log("Failed to announce:", err.message);
        });
}

function connectTwitchEventSub() {
    const ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

    ws.on("open", () => {
        console.log("Connected to Twitch EventSub WebSocket");
    });

    ws.on("message", async (raw) => {
        const msg = JSON.parse(raw.toString());
        const messageType = msg.metadata?.message_type;

        if (messageType === "session_welcome") {
            const sessionId = msg.payload.session.id;
            console.log("Session ID:", sessionId);

            await createSubscription(
                "channel.follow",
                "2",
                {
                    broadcaster_user_id: BROADCASTER_ID,
                    moderator_user_id: MODERATOR_ID
                },
                sessionId
            );

            await createSubscription(
                "channel.raid",
                "1",
                {
                    to_broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );

           await createSubscription(
                "channel.subscription.gift",
                "1",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );

            await createSubscription(
                "channel.subscribe",
                "1",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );

            await createSubscription(
                "channel.cheer",
                "1",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );

            await createSubscription(
                "channel.channel_points_custom_reward_redemption.add",
                "1",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );

            await createSubscription(
                "channel.hype_train.begin",
                "2",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );
            
            await createSubscription(
                "channel.hype_train.progress",
                "2",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );
            
            await createSubscription(
                "channel.hype_train.end",
                "2",
                {
                    broadcaster_user_id: BROADCASTER_ID
                },
                sessionId
            );
        }

        if (messageType === "notification") {
            const subType = msg.metadata.subscription_type;
            const event = msg.payload.event;

            console.log("Twitch event:", subType, event);

            if (subType === "channel.follow") {
                const history = recordAlert("follow", event.user_name);
                queueAlert("follow", event.user_name, "", "", history);
                const followerCount = await getFollowerCount();

                announceChat(
                    `@${event.user_name} just followed! (${followerCount ?? history.totals.follows} followers)`
                );
            }

            if (subType === "channel.subscription.gift") {
                const gifter = event.user_name || "Anonymous";
                const total = event.total || 1;

                let displayName;
                let extraText;
                let receiverName;

                if (total > 1) {
                    displayName = `${gifter.toUpperCase()} GIFTED x${total}`;
                    extraText = `${total} GIFT SUBS`;
                    receiverName = "";
                } else {
                    const recipient =
                        event.recipient_user_name ||
                        "UNKNOWN";

                    displayName = `${gifter.toUpperCase()} ◆ ${recipient.toUpperCase()}`;
                    extraText = gifter.toUpperCase();
                    receiverName = recipient.toUpperCase();
                }

                const history = recordAlert(
                    "giftsub",
                    displayName,
                    extraText,
                    receiverName
                );

                queueAlert(
                    "giftsub",
                    displayName,
                    extraText,
                    receiverName,
                    history
                );

                givePack(gifter);
                announceChat(`@${gifter} gifted ${total} sub${total === 1 ? "" : "s"}! The gifter gets 1 pack to redeem with !openpack`);
            }

            if (subType === "channel.subscribe") {

            if (event.is_prime) {

                const months = event.cumulative_months || 1;
            
                const monthText =
                    months === 1
                        ? "1 MONTH"
                        : `${months} MONTHS`;
            
                const history = recordAlert(
                    "primesub",
                    event.user_name,
                    monthText
                );
            
                queueAlert(
                    "primesub",
                    event.user_name,
                    monthText,
                    "",
                    history
                );
            
                givePack(event.user_name);
            
                announceChat(
                    `@${event.user_name} subscribed with Prime for ${months} month${months === 1 ? "" : "s"}! Redeem your pack with !openpack`
                );
            
                return;
            }
                const months = event.cumulative_months || 1;

                const history = recordAlert(
                    "sub",
                    event.user_name,
                    `${months} MONTHS`
                );

                queueAlert(
                    "sub",
                    event.user_name,
                    `${months} MONTHS`,
                    "",
                    history
                );

                givePack(event.user_name);
                announceChat(`@${event.user_name} subscribed with ${event.tier} for ${months} months! Redeem your pack with !openpack`);
            }

            if (subType === "channel.raid") {
                const history = recordAlert(
                    "raid",
                    event.from_broadcaster_user_name,
                    `${event.viewers} viewers`
                );

                queueAlert(
                    "raid",
                    event.from_broadcaster_user_name,
                    `${event.viewers} viewers`,
                    "",
                    history
                );

                announceChat(`@${event.from_broadcaster_user_name} raided with ${event.viewers} viewers!`);
                twitchClient.say(process.env.TWITCH_CHANNEL, `/shoutout ${event.from_broadcaster_user_login}`);
            }

            if (subType === "channel.cheer") {
                const history = recordAlert(
                    "bits",
                    event.user_name || "Anonymous",
                    `${event.bits} bits`
                );

                queueAlert(
                    "bits",
                    event.user_name || "Anonymous",
                    `${event.bits} bits`,
                    "",
                    history
                );

                announceChat(`@${event.user_name || "Anonymous"} cheered ${event.bits} bits!`);
            }

            if (subType === "channel.channel_points_custom_reward_redemption.add") {
                const history = recordAlert(
                    "redemption",
                    event.user_name,
                    event.user_input || "",
                    event.reward.title
                );

                queueAlert(
                    "redemption",
                    event.user_name,
                    event.user_input || "",
                    event.reward.title,
                    history
                );

                announceChat(`@${event.user_name} redeemed ${event.reward.title}!`);
            }

            if (
                subType === "channel.hype_train.begin" ||
                subType === "channel.hype_train.progress"
            ) {
                io.emit("hype-train-update", {
                    active: true,
                    level: event.level || 1,
                    progress: event.progress || event.total || 0,
                    goal: event.goal || 1,
                    expiresAt: event.expires_at || null,
                    topContributions: event.top_contributions || []
                });
            
                if (subType === "channel.hype_train.begin") {
                    announceChat(
                        `🚂 Hype Train has started! Level ${event.level || 1} is now active!`
                    );
                }
            
                if (subType === "channel.hype_train.progress") {
                    announceChat(
                        `🚂 Hype Train Level ${event.level || 1}: ${event.progress || event.total || 0}/${event.goal || 1} points!`
                    );
                }
            }
                           
            if (subType === "channel.hype_train.end") {
                io.emit("hype-train-update", {
                    active: false,
                    level: 0,
                    progress: 0,
                    goal: 1,
                    expiresAt: null,
                    topContributions: []
                });
            
                announceChat(
                    `🚂 Hype Train ended at Level ${event.level || 1}! Thank you for the support!`
                );
            }
        }

        if (messageType === "session_keepalive") {
            // Normal. Twitch is keeping the connection alive.
        }
    });

    ws.on("close", () => {
        console.log("Twitch EventSub disconnected. Reconnecting in 5 seconds...");
        setTimeout(connectTwitchEventSub, 5000);
    });

    ws.on("error", (err) => {
        console.log("Twitch EventSub error:", err.message);
    });
}

const COLLECTIONS_FILE = path.join(__dirname, "collections.json");
const CARDS_FILE = path.join(__dirname, "cards.json");

function loadCollections() {
    return JSON.parse(fs.readFileSync(COLLECTIONS_FILE, "utf8"));
}

function saveCollections(data) {
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(data, null, 2));
}

function loadCards() {
    return JSON.parse(fs.readFileSync(CARDS_FILE, "utf8"));
}

function givePack(username) {
    username = String(username || "").toLowerCase();

    const collections = loadCollections();

    if (!collections[username]) {
        collections[username] = {
            packs: 0,
            cards: {}
        };
    }

    collections[username].packs++;

    saveCollections(collections);

    console.log(username + " received a pack");
}

connectTwitchEventSub();
