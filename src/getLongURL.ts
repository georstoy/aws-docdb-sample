import { APIGatewayEvent, Callback, Context } from "aws-lambda";

import { MongoClient } from "mongodb";
import { connectToDB } from "./lib/db";
import { notFound, redirect, success } from "./lib/responses";

const DB_NAME = process.env.DB_NAME as string;

let dbClient: MongoClient;

export async function handler(event: APIGatewayEvent, context: Context, callback: Callback) {
    try {
        console.log(`In getLongURL`);
        console.log(`[DB_URL] ${process.env.DB_URL}`);
        dbClient = await connectToDB();
        const db = dbClient.db(DB_NAME);
        const id = event.pathParameters!["id"];
        const dbItem = await db.collection("urls").findOne({shortId: id});
        if (!dbItem) {
            return callback(null, notFound({}));
        }
        return callback(null, redirect(dbItem.url));
    } catch (err) {
        console.error(err);
        return callback(err);
    } finally {
        await dbClient.close();
    }
}
