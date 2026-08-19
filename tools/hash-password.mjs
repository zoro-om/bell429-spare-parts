#!/usr/bin/env node
/*
  Run locally with Node.js 20+ to generate a PBKDF2 record.
  Usage:
    node tools/hash-password.mjs
  Then put the resulting record into D1; NEVER put it in index.html.
*/
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output, randomBytes, pbkdf2 } from "node:crypto";

const rl = createInterface({ input, output });
const password = await rl.question("Password: ");
rl.close();

const iterations = 210000;
const salt = randomBytes(16);
const hash = await new Promise((resolve, reject) =>
  pbkdf2(password, salt, iterations, 32, "sha256", (e, h) => e ? reject(e) : resolve(h))
);

const b64url = b => b.toString("base64url");
console.log(`pbkdf2$${iterations}$${b64url(salt)}$${b64url(hash)}`);
