import { MongoClient } from "mongodb";
import { readFileSync } from "fs"

const ENVIRONMENT = process.env.ENVIRONMENT!;
const DB_URL = process.env.DB_URL as string;

export async function connectToDB(): Promise<MongoClient> { 
    if (ENVIRONMENT === "prod") {
        const ca = [readFileSync(`${__dirname}/rds-combined-ca-bundle.pem`)];
        const client: MongoClient = await MongoClient.connect(DB_URL, { ssl: true, sslValidate: true, sslCA: ca, useNewUrlParser: true});
        return client;
    }
    if (ENVIRONMENT === "dev") {
        const client: MongoClient = await MongoClient.connect(DB_URL, { useUnifiedTopology: true });
        return client;
    }    

    throw new Error("ENVIRONMENT not set");
}