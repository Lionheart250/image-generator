const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./anime_ai.db');

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
});

module.exports = db;