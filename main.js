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
      data BLOB,
      UNIQUE(url, visualizationName)
    );`,
      [],
      (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log("New table created if not exists");
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

ipcMain.on("get-data", (event) => {
  db.all(`SELECT * FROM responses`, [], (err, rows) => {
    if (err) {
      // Return error message to renderer process
      event.reply("data-received", { error: err.message });
    }

    // Return rows to renderer process
    event.reply("data-received", rows);
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

const updateData = (url, visualizationName, data) => {
  console.log("updateData-visualizationName", visualizationName);
  try {
    let stmt = db.prepare(`
    INSERT OR REPLACE INTO responses (url, visualizationName, data)
    VALUES (?, ?, ?)
  `);
    stmt.run(url, visualizationName, JSON.stringify(data));
    stmt.finalize();
  } catch (error) {
    console.error("Error updating data:", error);
    return error;
  }
};

// IPC listener
ipcMain.on("update-data-request", (event, args) => {
  console.log("Received update request:", args);

  const { url, visualizationName, data } = args;
  const error = updateData(url, visualizationName, data);

  if (error) {
    event.reply("update-data-response", "Data update failed: " + error.message);
  } else {
    event.reply("update-data-response", "Data updated successfully");
  }
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
