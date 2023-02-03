#!/bin/bash

cd web
node createProductionBundle.js
cd ..

cross build --target x86_64-unknown-linux-gnu --release
