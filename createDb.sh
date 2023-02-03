#!/bin/bash

cat db.sql | sqlite3 ./data/db.s3db
cat user_passwords.sql | sqlite3 ./data/user_passwords.s3db
cat user_sessions.sql | sqlite3 ./data/user_sessions.s3db
