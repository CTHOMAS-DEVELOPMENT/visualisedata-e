const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

function createWindow() {
  let win = new BrowserWindow({
    width: 1600,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false, // Add this line to disable the same-origin policy
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadURL("http://localhost:3000");
}

let db = new sqlite3.Database("./db/sample.db", (err) => {
  if (err) {
    return console.error(err.message);
  }

  console.log("Connected to the SQLite database.");

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      visualizationName TEXT,
      data BLOB
    );`,
      [],
      (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log("Table created if not exists");
      }
    );
  });

// Somewhere after you've created the table
db.get("SELECT COUNT(*) as count FROM responses", [], (err, row) => {
  if (err) {
    return console.error(err.message);
  }

  // row.count contains the number of rows in the responses table
  console.log(row.count);
});

});
// In main.js

ipcMain.on('get-data', (event) => {
  db.all(`SELECT * FROM responses`, [], (err, rows) => {
    if (err) {
      // Return error message to renderer process
      event.reply('data-received', { error: err.message });
    }
    
    // Return rows to renderer process
    event.reply('data-received', rows);
  });
});

ipcMain.on("save-data", (event, { url, visualizationName, data }) => {
  // Save the data to the SQLite database
  db.run(
    `INSERT INTO responses (url, visualizationName, data) VALUES (?, ?, ?)`,
    [url, visualizationName, JSON.stringify(data)],
    (err) => {
      if (err) {
        return console.error(err.message);
      }
      // When finished, send a response back to the renderer process
      event.reply("data-saved");
    }
  );
});
ipcMain.on("delete-record", (event, id) => {
  console.log("Received delete-record event with ID:", id);
  db.run(`DELETE FROM responses WHERE id = ?`, [id], (err) => {
    if (err) {
      return console.error(err.message);
    }
    event.reply("record-deleted", id);
  });
});

// Remember to close the database connection when your app is exiting
process.on("exit", () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Closed the database connection.");
  });
});
app.whenReady().then(createWindow);
