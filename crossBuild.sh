#!/bin/bash

cd web
npm install
node createProductionBundle.js
cd ..

cross build --target x86_64-unknown-linux-gnu --release
