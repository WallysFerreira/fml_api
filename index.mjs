import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocument.from(new DynamoDB());

export const handler = async (event) => {
    let statusCode = 200;
    let headers = {
        "Content-Type": "application/json"
    };
    let body;
    
    console.log(event);
    
    try {
        if (event.queryStringParameters.type == "board") {
            let response = await dynamo.get({
                TableName: "Boards",
                Key: { partitionKey: event.queryStringParameters.ID },
            });
            
            console.log(response);
            if (response.Item == undefined) {
                console.log("Board not found. Adding to database");
                
                let item = {
                    "partitionKey": event.queryStringParameters.ID,
                    "name": event.queryStringParameters.name,
                    "connectionID": event.requestContext.connectionId,
                    "power": 0,
                    "rgb": [0, 0, 0],
                    "rgb_history": [],
                };
            
                await dynamo.put({
                    TableName: "Boards",
                    Item: item,
                });
            } else {
                console.log("Board found. Updating connection ID");
                
                await dynamo.update({
                    TableName: "Boards",
                    Key: { partitionKey: event.queryStringParameters.ID },
                    UpdateExpression: "set connectionID = :connID",
                    ExpressionAttributeValues: { ":connID": event.requestContext.connectionId },
                });
            }
        } else if (event.queryStringParameters.type == "controller") {
            let response = await dynamo.get({
                TableName: "Controllers",
                Key: { email: event.queryStringParameters.ID },
            });
            
            if (response.Item == undefined) {
                console.log("Controller not found. Adding to database");
                
                let item = {
                    "email": event.queryStringParameters.ID,
                    "name": event.queryStringParameters.name,
                    "connectionID": event.requestContext.connectionId,
                    "boards": [],
                };
                
                await dynamo.put({
                    TableName: "Controllers",
                    Item: item,
                });
            } else {
                console.log("Controller found. Updating connection ID");
                
                await dynamo.update({
                    TableName: "Controllers",
                    Key: { email: event.queryStringParameters.ID },
                    UpdateExpression: "set connectionID = :connID",
                    ExpressionAttributeValues: { ":connID": event.requestContext.connectionId },
                });
            }
        }
    } catch (err) {
        console.log(err);
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }
    
    return {
        statusCode,
        body,
        headers,
    };
};

