import { MongoClient } from "mongodb";
import { readFileSync } from "fs"

const DB_URL = process.env.DB_URL as string;
const DB_CLIENT_OPTIONS = process.env.DB_CLIENT_OPTIONS || "";

export async function connectToDB(): Promise<MongoClient> {
    console.log(`CONNECTION ATTEMPT in LIB/DB!`);
    console.log(`[DB_NAME] ${process.env.DB_NAME}`);
    console.log(`[DB_URL] ${process.env.DB_URL}`);
    console.log(`[DB_CLIENT_OPTIONS] ${DB_CLIENT_OPTIONS}`);
    const client: MongoClient = await MongoClient.connect(DB_URL as string, JSON.parse(DB_CLIENT_OPTIONS));
    return client;
}