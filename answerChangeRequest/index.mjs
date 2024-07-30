import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = DynamoDBDocument.from(new DynamoDB());
const HISTORY_MAX = 3;

export const handler = async (event) => {
  console.log(event);
  let statusCode = 200;
  const eventBody = JSON.parse(event.body);
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const client = new ApiGatewayManagementApiClient({ endpoint: `https://${domain}/${stage}` });
  let boardPKey;
  
  if (eventBody.data.confirmed) {
    const response = await dynamo.scan({
      TableName: "Boards",
      FilterExpression: "connectionID = :connID",
      ExpressionAttributeValues: { ":connID": event.requestContext.connectionId },
    });
    boardPKey = response.Items[0].partitionKey;
    const colors = ["red", "green", "blue"];
    
    if (colors.includes(eventBody.data.attribute) || eventBody.data.attribute == "rgb") {
      if (JSON.stringify(response.Items[0].rgb) != JSON.stringify(response.Items[0].rgb_history[HISTORY_MAX - 1])) {
        console.log("Updating history");
        
        if (response.Items[0].rgb_history.length == HISTORY_MAX) {
          console.log("Deleting oldest history entry");
          
          await dynamo.update({
            TableName: "Boards",
            Key: { partitionKey: boardPKey },
            UpdateExpression: "remove rgb_history[0]",
          });
        }
        
        await dynamo.update({
          TableName: "Boards",
          Key: { partitionKey: boardPKey },
          UpdateExpression: "set rgb_history = list_append(rgb_history, :hist)",
          ExpressionAttributeValues: {
            ":hist": [response.Items[0].rgb],
          },
        });     
      }
    }
    
    if (colors.includes(eventBody.data.attribute)) {
      await dynamo.update({
        TableName: "Boards",
        Key: { partitionKey: boardPKey },
        UpdateExpression: `set rgb[${colors.indexOf(eventBody.data.attribute)}] = :val`,
        ExpressionAttributeValues: {
          ":val": eventBody.data.value,
        },
      });     
    } else {
      await dynamo.update({
        TableName: "Boards",
        Key: { partitionKey: boardPKey },
        UpdateExpression: `set ${eventBody.data.attribute} = :val`,
        ExpressionAttributeValues: {
          ":val": eventBody.data.value,
        },
      });
    }
  }
  
  if (eventBody.data.controllerID == "gesture") {
    console.log("Gesture");
    
    const response = await dynamo.scan({
      TableName: "Controllers",
      FilterExpression: "contains(boards, :boardPKey)",
      ExpressionAttributeValues: { ":boardPKey": boardPKey},
    });
    
    const owners = response.Items;
    console.log(owners);
    
    for (let owner of owners) {
      if (owner.connectionID != undefined) {
        const command = new PostToConnectionCommand({
          ConnectionId: owner.connectionID,
          Data: JSON.stringify(eventBody.data),
        });
      
        try {
          await client.send(command);
        } catch (err) {
          statusCode = 500;
          console.log(err);
        }
      }
    }
    
  } else if (eventBody.data.controllerID != "null") {
    const response = await dynamo.get({
      TableName: "Controllers",
      Key: { email: eventBody.data.controllerID },
    });
    const controllerConnectionID = response.Item.connectionID;
    
    const command = new PostToConnectionCommand({
      ConnectionId: controllerConnectionID, 
      Data: JSON.stringify(eventBody.data),
    });
    
    try {
      await client.send(command);
    } catch (err) {
      statusCode = 500;
      console.log(err);
    }
  }
  
  return {
    statusCode,
  };
};
