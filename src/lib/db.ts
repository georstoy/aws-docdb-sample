import { MongoClient } from "mongodb";
import { readFileSync } from "fs"

const DB_URL = process.env.DB_URL as string;
const ca = [readFileSync(`${__dirname}/rds-combined-ca-bundle.pem`)];

export async function connectToDB() {
    console.log(`CONNECTION ATTEMPT!`);
    console.log(`[DB_URL] ${DB_URL}`);
    const client = await MongoClient.connect(DB_URL as string, { ssl: true, sslValidate: true, sslCA: ca, useNewUrlParser: true });
    return client;
}