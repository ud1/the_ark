use std::fs;
use std::io;
use r2d2::ManageConnection;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

pub fn create_db() -> std::io::Result<()>
{
    fs::create_dir_all("data")?;

    if !std::path::Path::new("data/db.s3db").exists() {
        let main_db_manager = SqliteConnectionManager::file("data/db.s3db");
        let connection = main_db_manager.connect().expect("Create data/db.s3db error");
        execute(&connection, include_str!("../db.sql"))?;
    }

    if !std::path::Path::new("data/user_passwords.s3db").exists() {
        let main_db_manager = SqliteConnectionManager::file("data/user_passwords.s3db");
        let connection = main_db_manager.connect().expect("Create data/user_passwords.s3db error");
        execute(&connection, include_str!("../user_passwords.sql"))?;
    }

    if !std::path::Path::new("data/user_sessions.s3db").exists() {
        let main_db_manager = SqliteConnectionManager::file("data/user_sessions.s3db");
        let connection = main_db_manager.connect().expect("Create data/user_sessions.s3db error");
        execute(&connection, include_str!("../user_sessions.sql"))?;
    }

    Ok(())
}

fn execute(conn: &Connection, commands: &str) -> std::io::Result<()> {
    let lines = commands.split(";");

    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        println!("Execute {}", line);
        conn.execute(line, []).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    }

    Ok(())
}